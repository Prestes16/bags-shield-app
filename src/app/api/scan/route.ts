import { NextRequest, NextResponse } from "next/server";
import {
  fetchMintAccount,
  fetchLargestAccounts,
  calculateTop10Concentration,
} from "@/lib/solanaRpc";
import { validateBackendUrl } from "@/lib/urlValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isProbablyHtml(text: string) {
  const t = text.trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<head") || t.includes("<body");
}

function cleanBase(base: string) {
  return base.replace(/\/+$/, "");
}

function isLikelyMint(s: string) {
  const t = (s || "").trim();
  if (t.length < 32 || t.length > 44) return false;
  // base58 (sem 0 O I l)
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(t);
}

/**
 * Fallback: fetch on-chain data when backend is unreachable
 */
async function fallbackOnChainScan(mint: string) {
  const rpcUrl =
    process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const timeoutMs = 10_000;

  try {
    // Fetch mint account and largest accounts in parallel
    const [mintInfo, largestAccounts] = await Promise.all([
      fetchMintAccount(mint, { rpcUrl, timeoutMs }),
      fetchLargestAccounts(mint, { rpcUrl, timeoutMs }),
    ]);

    if (!mintInfo) {
      return {
        success: false,
        error: "Mint account not found on-chain.",
      };
    }

    // Calculate top 10 concentration
    const top10Concentration = calculateTop10Concentration(
      largestAccounts,
      mintInfo.supply
    );

    // Build response in same envelope format
    const response: any = {
      mint,
      tokenMeta: {
        mint,
        symbol: "Unknown",
        name: "Unknown",
      },
      shieldScore: null, // Cannot calculate without backend
      grade: null,
      riskLabel: "Unknown",
      findings: [],
      authorities: {
        mintAuthority: mintInfo.mintAuthority,
        freezeAuthority: mintInfo.freezeAuthority,
        updateAuthority: null,
      },
      metadata: {
        decimals: mintInfo.decimals,
        supply: mintInfo.supply,
        symbol: null,
        name: null,
      },
    };

    if (top10Concentration !== null) {
      response.holders = {
        top10Concentration,
        totalHolders: largestAccounts.length > 0 ? largestAccounts.length : null,
      };
    }

    // Add findings based on authorities
    const findings: any[] = [];

    if (mintInfo.mintAuthority) {
      findings.push({
        id: "mint-authority",
        title: "Mint Authority Present",
        description: "Token can mint new supply",
        severity: "high",
        details: `Mint authority: ${mintInfo.mintAuthority}`,
      });
    }

    if (mintInfo.freezeAuthority) {
      findings.push({
        id: "freeze-authority",
        title: "Freeze Authority Present",
        description: "Token accounts can be frozen",
        severity: "medium",
        details: `Freeze authority: ${mintInfo.freezeAuthority}`,
      });
    }

    if (top10Concentration !== null && top10Concentration > 50) {
      findings.push({
        id: "holder-concentration",
        title: "High Holder Concentration",
        description: `Top 10 holders control ${top10Concentration.toFixed(1)}% of supply`,
        severity: top10Concentration > 80 ? "high" : "medium",
        details: `Top 10 concentration: ${top10Concentration.toFixed(1)}%`,
      });
    }

    response.findings = findings;

    return {
      success: true,
      response,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "On-chain fallback failed.",
    };
  }
}

export async function POST(req: NextRequest) {
  // Helper para respostas JSON com no-store
  const jsonNoStore = (data: any, status = 200) => {
    return NextResponse.json(data, {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "application/json",
      },
    });
  };

  try {
    // Content-Type validation
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return jsonNoStore(
        { success: false, error: "Content-Type must be application/json" },
        400
      );
    }

    // Body size limit (413)
    const MAX_SCAN_BODY_BYTES = 8 * 1024; // 8KB é MUITO pra { mint }
    
    const raw = await req.text().catch(() => "");
    if (raw.length > MAX_SCAN_BODY_BYTES) {
      return jsonNoStore(
        { success: false, error: "Payload too large" },
        413
      );
    }
    
    // Parse JSON defensivo
    let body: any = null;
    try {
      body = JSON.parse(raw);
    } catch {
      // Se falhar, tenta extrair mint diretamente do raw (fallback para casos edge)
      const mintMatch = raw.match(/["']?mint["']?\s*[:=]\s*["']?([^"',}\s]+)["']?/i);
      if (mintMatch && mintMatch[1]) {
        body = { mint: mintMatch[1] };
      }
    }

    const mint = (body && typeof body === "object" && body !== null ? (body as any).mint : "").toString().trim();

    if (!mint || !isLikelyMint(mint)) {
      return jsonNoStore(
        { success: false, error: "Invalid mint. Provide a Solana token mint address." },
        400
      );
    }

    const baseRaw = (process.env.BAGS_SHIELD_API_BASE || process.env.NEXT_PUBLIC_BAGS_SHIELD_API_BASE || "").trim();

    if (!baseRaw) {
      // ✅ sem backend configurado = fallback permitido
      const fallback = await fallbackOnChainScan(mint);
      if (fallback.success) {
        return jsonNoStore(fallback, 200);
      }
      return jsonNoStore(
        {
          success: false,
          error: "Backend not configured and on-chain fallback failed. Set BAGS_SHIELD_API_BASE to your Bags Shield API deployment base URL.",
        },
        500
      );
    }

    // SSRF Protection: validate backend URL
    const urlValidation = validateBackendUrl(baseRaw, { kind: "backend" });
    if (!urlValidation.valid) {
      // ✅ backend configurado mas inválido = FAIL-CLOSED (não fallback)
      return jsonNoStore(
        {
          success: false,
          error: `Invalid backend URL: ${urlValidation.error}`,
        },
        400
      );
    }

    // Use normalized URL if available, otherwise clean base
    const base = urlValidation.normalized || cleanBase(baseRaw);

    // tenta caminhos comuns (sem você precisar adivinhar agora)
    const candidates = [
      `${base}/api/scan`,
      `${base}/api/v0/scan`,
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let lastText = "";
    let lastStatus = 502;

    for (const url of candidates) {
      try {
        const upstream = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ mint }),
          redirect: "manual", // ✅ CRÍTICO: bloqueia redirects SSRF
          signal: controller.signal,
        });

        // ✅ Se backend tentar redirecionar, retorna erro (não tenta próximo candidato)
        if (upstream.status >= 300 && upstream.status < 400) {
          clearTimeout(timeout);
          return jsonNoStore(
            {
              success: false,
              error: "Backend redirect blocked for security",
            },
            502
          );
        }

        const ct = upstream.headers.get("content-type") || "";
        const status = upstream.status;

        // se for JSON, repassa
        if (ct.includes("application/json")) {
          const data = await upstream.json().catch(() => null);
          clearTimeout(timeout);

          if (data && typeof data === "object") {
            return jsonNoStore(data, status);
          }

          return jsonNoStore(
            { success: false, error: "Invalid JSON from backend." },
            502
          );
        }

        // não é JSON → lê texto e detecta HTML
        const text = await upstream.text().catch(() => "");
        lastText = text;
        lastStatus = status;

        if (isProbablyHtml(text)) {
          // tenta próximo candidato
          continue;
        }

        // texto não-HTML (ex: NOT_FOUND plaintext)
        // tenta próximo candidato também
        continue;
      } catch (e) {
        // tenta próximo candidato
        continue;
      }
    }

    clearTimeout(timeout);

    // Backend unreachable → try on-chain fallback (OK - backend legítimo caiu)
    try {
      const fallback = await fallbackOnChainScan(mint);
      if (fallback.success) {
        return jsonNoStore(fallback, 200);
      }
      // Fallback failed, return error
      return jsonNoStore(fallback, 502);
    } catch (fallbackErr: any) {
      // Fallback threw, return original error
      const hint =
        isProbablyHtml(lastText)
          ? "Backend returned HTML (likely wrong route/domain or a platform error page)."
          : "Backend route not found or not returning JSON.";

      return jsonNoStore(
        {
          success: false,
          error: `Scan backend unreachable. ${hint} Check BAGS_SHIELD_API_BASE and deployed routes. On-chain fallback also failed.`,
        },
        502
      );
    }
  } catch (err: any) {
    // Never expose internal error details
    const safeError = err?.message && err.message.includes("SSRF") 
      ? err.message 
      : "Scan proxy error.";
    return jsonNoStore(
      { success: false, error: safeError },
      500
    );
  }
}

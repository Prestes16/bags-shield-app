import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; 

// Correção de Sintaxe: Concatenação segura para evitar erro de escape
const API_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=" + API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let mint = body.mint || body.input || body.query;

    if (!mint) {
      return NextResponse.json({ success: false, error: "Mint/Input required" }, { status: 400 });
    }

    mint = mint.trim();

    // 1. Chamada Helius DAS (GetAsset)
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'bags-shield-scan',
        method: 'getAsset',
        params: { id: mint }
      })
    });

    const { result, error } = await response.json();

    if (error || !result) {
      console.error("Helius Error:", error);
      return NextResponse.json({ 
        success: true, 
        response: {
            tokenInfo: { name: "Not Found", symbol: "???", image: null, mint },
            security: { score: 0, isSafe: false, badges: ["SCAN_ERROR"] },
            findings: [{ type: "error", label: "Token not found on-chain" }]
        }
      });
    }

    // 2. Extração de Dados
    const name = result.content?.metadata?.name || "Unknown";
    const symbol = result.content?.metadata?.symbol || "UNK";
    const image = result.content?.links?.image || "";
    
    const mintAuthority = result.authorities?.find((a: any) => a.scopes.includes("mint"));
    const freezeAuthority = result.authorities?.find((a: any) => a.scopes.includes("freeze"));
    const mutable = result.mutable;

    // 3. Algoritmo de Score
    let score = 90;
    const badges = [];
    const findings = [];

    if (mintAuthority) {
      score -= 30;
      badges.push("MINT_AUTH");
      findings.push({ type: "warning", label: "Mint Authority Enabled" });
    }
    if (freezeAuthority) {
      score -= 20;
      badges.push("FREEZE_AUTH");
      findings.push({ type: "warning", label: "Freeze Authority Enabled" });
    }
    if (mutable) {
        score -= 10;
        findings.push({ type: "info", label: "Metadata is Mutable" });
    }

    return NextResponse.json({
      success: true,
      response: {
        tokenInfo: { name, symbol, image, mint },
        security: {
            score,
            isSafe: score > 60,
            grade: score > 80 ? 'A' : score > 60 ? 'B' : score > 40 ? 'C' : 'D',
            badges
        },
        findings
      }
    });

  } catch (error: any) {
    console.error("API Scan Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

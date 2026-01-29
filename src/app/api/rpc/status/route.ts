import { NextRequest } from "next/server";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";
import { getSecurityHeaders, safeLog } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/rpc/status
 * Diagnostic endpoint for RPC configuration
 * Tests RPC connectivity without heavy operations
 */
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);

  try {
    // Check server-side RPC URL (preferred)
    const serverRpcUrl = process.env.SOLANA_RPC_URL?.trim();
    const publicRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
    
    const configured = !!(serverRpcUrl || publicRpcUrl);
    const urlKind = serverRpcUrl ? "private" : publicRpcUrl ? "public" : "none";
    const rpcUrl = serverRpcUrl || publicRpcUrl || "https://api.mainnet-beta.solana.com";

    // Validate URL format (basic check)
    let urlValid = false;
    try {
      const url = new URL(rpcUrl);
      urlValid = url.protocol === "https:" || url.protocol === "http:";
    } catch {
      urlValid = false;
    }

    // Test RPC connectivity with a lightweight call (getHealth)
    let ok = false;
    let latencyMs: number | null = null;
    let lastError: string | undefined;

    if (configured && urlValid) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getHealth",
          }),
          signal: controller.signal,
          redirect: "manual",
        });

        clearTimeout(timeout);
        latencyMs = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json().catch(() => null);
          // getHealth returns { result: "ok" } when healthy
          ok = data?.result === "ok" || response.status === 200;
        } else {
          lastError = `RPC returned ${response.status}`;
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          lastError = "RPC timeout (>5s)";
        } else {
          lastError = err?.message || "RPC request failed";
          // Sanitize error message (remove sensitive info)
          if (lastError && (lastError.includes("ENOTFOUND") || lastError.includes("ECONNREFUSED"))) {
            lastError = "RPC endpoint unreachable";
          }
        }
      }
    } else if (!configured) {
      lastError = "RPC URL not configured";
    } else {
      lastError = "Invalid RPC URL format";
    }

    // Never expose RPC URL in response (security: prevent SSRF)
    return jsonNoStore(
      {
        success: true,
        response: {
          configured,
          urlKind, // Only expose kind (private/public/none), not the actual URL
          ok,
          ...(latencyMs !== null && { latencyMs }),
          ...(lastError && { lastError }),
          timestamp: new Date().toISOString(),
        },
        meta: {
          requestId,
        },
      },
      { requestId, headers: getSecurityHeaders() }
    );
  } catch (err: any) {
    safeLog("error", "RPC status error", { requestId, error: err?.message });
    return jsonNoStore(
      {
        success: false,
        error: "Failed to get RPC status",
        meta: { requestId },
      },
      { status: 500, requestId, headers: getSecurityHeaders() }
    );
  }
}

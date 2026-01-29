import { NextRequest } from "next/server";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { getSecurityHeaders, safeLog } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/helius/status
 * Diagnostic endpoint for Helius configuration
 * Does NOT call Helius API (to avoid spending credits)
 */
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);

  try {
    // Single source of truth: HELIUS_RPC_URL (must stay server-side)
    const rpcUrl = (process.env.HELIUS_RPC_URL || "").trim();

    let configured = false;
    let rpcHost: string | undefined;
    let hasApiKey = false;

    if (rpcUrl) {
      try {
        const u = new URL(rpcUrl);
        rpcHost = u.host;
        hasApiKey = u.searchParams.has("api-key");
        configured = hasApiKey; // require api-key to consider "configured"
      } catch {
        // If URL parsing fails, at least signal "something is set"
        configured = true;
      }
    }

    // Cluster (sanitized)
    const clusterRaw = process.env.HELIUS_CLUSTER || "mainnet";
    let cluster = "mainnet";
    if (typeof clusterRaw === "string") {
      const normalized = clusterRaw.toLowerCase().trim();
      const allowedClusters = ["devnet", "mainnet", "mainnet-beta"];
      if (allowedClusters.includes(normalized)) {
        cluster = normalized === "mainnet-beta" ? "mainnet" : normalized;
      }
    }

    // Feature flag
    const enabled = isFeatureEnabled("HELIUS_ENABLED");

    let lastError: string | undefined;
    try {
      lastError = undefined;
    } catch {}

    return jsonNoStore(
      {
        success: true,
        response: {
          configured,
          enabled,
          cluster,
          hasApiKey,
          ...(rpcHost ? { rpcHost } : {}),
          ...(lastError && { lastError }),
          timestamp: new Date().toISOString(),
        },
        meta: { requestId },
      },
      { requestId, headers: getSecurityHeaders() }
    );
  } catch (err: any) {
    safeLog("error", "Helius status error", { requestId, error: err?.message });
    return jsonNoStore(
      { success: false, error: "Failed to get Helius status", meta: { requestId } },
      { status: 500, requestId, headers: getSecurityHeaders() }
    );
  }
}

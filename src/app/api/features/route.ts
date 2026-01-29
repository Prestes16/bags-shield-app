import { NextRequest } from "next/server";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";
import { getClientFeatureFlags } from "@/lib/featureFlags";
import { getFeesConfigFromEnv } from "@/lib/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/features
 * Returns client-safe feature flags and fees configuration
 * Always returns JSON, never crashes (fail-closed)
 */
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  
  try {
    const flags = getClientFeatureFlags();
    const feesConfig = getFeesConfigFromEnv();
    const { getFeatureFlags } = await import("@/lib/featureFlags");
    const serverFlags = getFeatureFlags();

    // Check if wallets are configured (valid base58, not placeholder)
    const appFeeConfigured = !!(feesConfig.opsWallet && feesConfig.opsWallet.length >= 32 && feesConfig.opsWallet.length <= 44);
    const proScanConfigured = appFeeConfigured; // Pro Scan uses OPS wallet

    // Use placeholder for invalid wallets (fail-closed)
    const opsWallet = feesConfig.opsWallet || "11111111111111111111111111111112";
    const treasuryWallet = feesConfig.treasuryWallet || "11111111111111111111111111111112";

    return jsonNoStore(
      {
        success: true,
        response: {
          ...flags,
          fees: {
            proScanEnabled: feesConfig.proScanEnabled || false,
            proScanLamports: Number(feesConfig.proScanLamports || BigInt(100000)),
            appFeeBps: feesConfig.appFeeBps || 20,
            wallets: {
              ops: opsWallet,
              treasury: treasuryWallet,
            },
            configured: {
              appFee: appFeeConfigured,
              proScan: proScanConfigured,
            },
          },
        },
      },
      { requestId }
    );
  } catch (err: any) {
    // Never expose internal error details - fail-closed
    const safeError = "Internal error";
    return jsonNoStore(
      {
        success: false,
        error: safeError,
        meta: {
          requestId,
          hint: "Feature flags service temporarily unavailable",
        },
      },
      { 
        requestId,
        status: 500,
      }
    );
  }
}

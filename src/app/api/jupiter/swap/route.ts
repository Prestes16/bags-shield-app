import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";
import { getJupiterSwap, JupiterSwapRequest } from "@/lib/jupiter";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { resolveAppFeeForSwap } from "@/lib/fees";
import {
  validatePublicKey,
  validateContentType,
  validateBodySize,
  rateLimitMiddleware,
  safeLog,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FeeAccount (Jupiter):
 * - MUST be an initialized token account (ATA), not a wallet address.
 * - Mint must be inputMint or outputMint.
 */
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

function deriveAta(ownerBase58: string, mintBase58: string) {
  const owner = new PublicKey(ownerBase58);
  const mint = new PublicKey(mintBase58);
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata.toBase58();
}

/**
 * POST /api/jupiter/swap
 * Server-side proxy to obtain swap transaction from Jupiter.
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  const startTime = Date.now();

  try {
    // Rate limiting (stricter for swap)
    const rateLimit = await rateLimitMiddleware(req, { windowMs: 60_000, maxRequests: 10 });
    if (!rateLimit.allowed) {
      safeLog("warn", "Jupiter swap rate limit exceeded", { requestId });
      return jsonNoStore(
        {
          success: false,
          error: "Rate limit exceeded",
          meta: { requestId, retryAfter: 60 },
        },
        { status: 429, requestId }
      );
    }

    // Feature flag
    if (!isFeatureEnabled("JUPITER_SWAP_ENABLED")) {
      return jsonNoStore(
        { success: false, error: "Jupiter swap is disabled" },
        { status: 403, requestId }
      );
    }

    // Content-Type validation
    const contentTypeValidation = validateContentType(req.headers.get("content-type"));
    if (!contentTypeValidation.valid) {
      return jsonNoStore(
        { success: false, error: contentTypeValidation.error || "Invalid Content-Type" },
        { status: 400, requestId }
      );
    }

    // Body size validation
    const raw = await req.text().catch(() => "");
    const bodySizeValidation = validateBodySize(raw, 16 * 1024);
    if (!bodySizeValidation.valid) {
      return jsonNoStore(
        { success: false, error: bodySizeValidation.error || "Payload too large" },
        { status: 413, requestId }
      );
    }

    const body = JSON.parse(raw);
    if (!body || typeof body !== "object") {
      return jsonNoStore(
        { success: false, error: "Invalid request body" },
        { status: 400, requestId }
      );
    }

    // Required fields
    const { quoteResponse, userPublicKey } = body;
    if (!quoteResponse || !userPublicKey) {
      return jsonNoStore(
        { success: false, error: "Missing required fields: quoteResponse, userPublicKey" },
        { status: 400, requestId }
      );
    }

    // Validate quote response structure
    if (typeof quoteResponse !== "object" || !quoteResponse.inputMint || !quoteResponse.outputMint) {
      return jsonNoStore(
        { success: false, error: "Invalid quoteResponse structure" },
        { status: 400, requestId }
      );
    }

    // Validate user public key
    const publicKeyValidation = validatePublicKey(userPublicKey);
    if (!publicKeyValidation.valid) {
      safeLog("warn", "Invalid userPublicKey", { requestId, error: publicKeyValidation.error });
      return jsonNoStore(
        { success: false, error: publicKeyValidation.error || "Invalid userPublicKey" },
        { status: 400, requestId }
      );
    }

    // Determine direction from quote
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const isOutputSOLOrUSDC = quoteResponse.outputMint === SOL_MINT || quoteResponse.outputMint === USDC_MINT;
    const direction: "buy" | "sell" = isOutputSOLOrUSDC ? "sell" : "buy";

    const feeResolution = resolveAppFeeForSwap({
      inputMint: quoteResponse.inputMint,
      outputMint: quoteResponse.outputMint,
      swapMode: quoteResponse.swapMode as "ExactIn" | "ExactOut",
      direction,
    });

    // FeeAccount (ATA) — only if fee is enabled
    let feeAccount: string | undefined;
    if (feeResolution.enabled && feeResolution.feeWallet) {
      const feeWalletValidation = validatePublicKey(feeResolution.feeWallet);
      if (!feeWalletValidation.valid) {
        safeLog("warn", "Invalid feeWallet", { requestId, feeWallet: feeResolution.feeWallet });
        return jsonNoStore(
          { success: false, error: "Invalid fee wallet configuration" },
          { status: 500, requestId }
        );
      }

      // Fee mint depends on swapMode:

      // - ExactIn  => fee on outputMint

      // - ExactOut => fee on inputMint

      const feeMint = quoteResponse.swapMode === "ExactOut" ? quoteResponse.inputMint : quoteResponse.outputMint;

      feeAccount = deriveAta(feeResolution.feeWallet, feeMint);

      }

    const swapRequest: JupiterSwapRequest = {
      quoteResponse,
      userPublicKey: publicKeyValidation.sanitized!,
      wrapAndUnwrapSol: body.wrapAndUnwrapSol === true,
      dynamicComputeUnitLimit: body.dynamicComputeUnitLimit !== false,
      prioritizationFeeLamports:
        typeof body.prioritizationFeeLamports === "number" && body.prioritizationFeeLamports >= 0
          ? body.prioritizationFeeLamports
          : undefined,
      asLegacyTransaction: body.asLegacyTransaction === true,
      feeAccount: feeResolution.enabled ? feeAccount : undefined,
    };

    const result = await getJupiterSwap(swapRequest);
    const elapsedMs = Date.now() - startTime;

    if (!result.success) {
      return jsonNoStore(
        { success: false, error: result.error, meta: { requestId, elapsedMs } },
        { status: 500, requestId }
      );
    }

    return jsonNoStore(
      { success: true, response: result.data, meta: { requestId, elapsedMs } },
      { requestId }
    );
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    safeLog("error", "Jupiter swap error", { requestId, error: err?.message });
    return jsonNoStore(
      { success: false, error: "Internal server error", meta: { requestId, elapsedMs } },
      { status: 500, requestId }
    );
  }
}

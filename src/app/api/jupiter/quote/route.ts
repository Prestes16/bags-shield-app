import { NextRequest } from "next/server";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";
import { getJupiterQuote, JupiterQuoteRequest } from "@/lib/jupiter";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { resolveAppFeeForSwap } from "@/lib/fees";
import {
  validateMint,
  validateNumericString,
  validateContentType,
  validateBodySize,
  rateLimitMiddleware,
  safeLog,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/jupiter/quote
 * Get Jupiter quote (server-side proxy for security)
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  const startTime = Date.now();

  try {
    // Rate limiting
    const rateLimit = await rateLimitMiddleware(req, { windowMs: 60_000, maxRequests: 20 });
    if (!rateLimit.allowed) {
      safeLog("warn", "Jupiter quote rate limit exceeded", { requestId });
      return jsonNoStore(
        {
          success: false,
          error: "Rate limit exceeded",
          meta: { requestId, retryAfter: 60 },
        },
        { status: 429, requestId }
      );
    }

    // Check feature flag
    if (!isFeatureEnabled("JUPITER_SWAP_ENABLED")) {
      return jsonNoStore(
        {
          success: false,
          error: "Jupiter swap is disabled",
        },
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
    const bodySizeValidation = validateBodySize(raw, 4 * 1024);
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

    // Validate required fields
    const { inputMint, outputMint, amount, slippageBps } = body;
    if (!inputMint || !outputMint || !amount) {
      return jsonNoStore(
        {
          success: false,
          error: "Missing required fields: inputMint, outputMint, amount",
        },
        { status: 400, requestId }
      );
    }

    // Validate mint addresses
    const inputMintValidation = validateMint(inputMint);
    if (!inputMintValidation.valid) {
      safeLog("warn", "Invalid inputMint", { requestId, error: inputMintValidation.error });
      return jsonNoStore(
        { success: false, error: inputMintValidation.error || "Invalid inputMint" },
        { status: 400, requestId }
      );
    }

    const outputMintValidation = validateMint(outputMint);
    if (!outputMintValidation.valid) {
      safeLog("warn", "Invalid outputMint", { requestId, error: outputMintValidation.error });
      return jsonNoStore(
        { success: false, error: outputMintValidation.error || "Invalid outputMint" },
        { status: 400, requestId }
      );
    }

    // Validate amount
    const amountValidation = validateNumericString(String(amount), { min: 1, allowDecimals: false });
    if (!amountValidation.valid) {
      return jsonNoStore(
        { success: false, error: amountValidation.error || "Invalid amount (must be positive integer)" },
        { status: 400, requestId }
      );
    }

    // Validate slippage (1-500 bps = 0.01%-5%)
    const slippageValidation = validateNumericString(
      String(slippageBps ?? 50),
      { min: 1, max: 500, allowDecimals: false }
    );
    if (!slippageValidation.valid) {
      return jsonNoStore(
        { success: false, error: slippageValidation.error || "Invalid slippageBps (must be 1-500)" },
        { status: 400, requestId }
      );
    }
    const slippage = Number(slippageValidation.sanitized);

    // Validate amount limit (max 50 SOL in lamports = 50_000_000_000)
    const amountNum = BigInt(amountValidation.sanitized!);
    const MAX_AMOUNT_LAMPORTS = BigInt(50_000_000_000); // 50 SOL
    if (amountNum > MAX_AMOUNT_LAMPORTS) {
      return jsonNoStore(
        { success: false, error: "Amount exceeds maximum (50 SOL)" },
        { status: 400, requestId }
      );
    }

    // Determine direction (buy/sell)
    // If outputMint is the target token and inputMint is SOL/USDC => buy
    // If outputMint is SOL/USDC => sell
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const isInputSOLOrUSDC = inputMintValidation.sanitized === SOL_MINT || inputMintValidation.sanitized === USDC_MINT;
    const isOutputSOLOrUSDC = outputMintValidation.sanitized === SOL_MINT || outputMintValidation.sanitized === USDC_MINT;
    
    let direction: "buy" | "sell" = "buy";
    if (isOutputSOLOrUSDC) {
      direction = "sell";
    } else if (isInputSOLOrUSDC && body.direction) {
      // Allow explicit direction override
      direction = body.direction === "sell" ? "sell" : "buy";
    }

    // Get feature flags for fee validation
    const { getFeatureFlags } = await import("@/lib/featureFlags");
    const flags = getFeatureFlags();

    // Resolve app fee (v1: OPS wallet only)
    // Fee is only applied if APP_FEE_ENABLED=true AND OPS wallet is valid
    const feeResolution = resolveAppFeeForSwap({
      inputMint: inputMintValidation.sanitized!,
      outputMint: outputMintValidation.sanitized!,
      swapMode: "ExactIn", // Jupiter quote is always ExactIn
      direction,
    });

    const quoteRequest: JupiterQuoteRequest = {
      inputMint: inputMintValidation.sanitized!,
      outputMint: outputMintValidation.sanitized!,
      amount: amountValidation.sanitized!,
      slippageBps: slippage,
      onlyDirectRoutes: body.onlyDirectRoutes === true,
      asLegacyTransaction: body.asLegacyTransaction === true,
      platformFeeBps: feeResolution.enabled && feeResolution.feeWallet ? feeResolution.platformFeeBps : undefined,
    };

    const result = await getJupiterQuote(quoteRequest);

    const elapsedMs = Date.now() - startTime;

    if (!result.success) {
      return jsonNoStore(
        {
          success: false,
          error: result.error,
          meta: { requestId, elapsedMs },
        },
        { status: 500, requestId }
      );
    }

    return jsonNoStore(
      {
        success: true,
        response: result.data,
        meta: {
          requestId,
          elapsedMs,
          appFeeApplied: feeResolution.enabled && !!feeResolution.feeWallet,
          appFeeBps: feeResolution.enabled && feeResolution.feeWallet ? feeResolution.platformFeeBps : undefined,
          ...(feeResolution.enabled === false && {
            appFeeReason: !flags.APP_FEE_ENABLED
              ? "App fee disabled"
              : !flags.APP_FEE_WALLET_OPS
              ? "OPS wallet not configured"
              : feeResolution.feeMint === null
              ? "Fee mint not in swap pair"
              : "Fee not applicable",
          }),
        },
      },
      { requestId }
    );
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    safeLog("error", "Jupiter quote error", { requestId, error: err?.message });
    return jsonNoStore(
      {
        success: false,
        error: "Internal server error",
        meta: { requestId, elapsedMs },
      },
      { status: 500, requestId }
    );
  }
}

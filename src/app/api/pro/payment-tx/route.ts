import { NextRequest } from "next/server";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";
import { getFeesConfigFromEnv, validateSolanaAddressBase58 } from "@/lib/fees";
import {
  validatePublicKey,
  validateContentType,
  validateBodySize,
  rateLimitMiddleware,
  safeLog,
  getSecurityHeaders,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/pro/payment-tx
 * Build SystemProgram transfer transaction for Pro Scan payment
 * Returns transaction in format ready for wallet signing
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  const startTime = Date.now();

  try {
    // Rate limiting
    const rateLimit = await rateLimitMiddleware(req, { windowMs: 60_000, maxRequests: 20 });
    if (!rateLimit.allowed) {
      safeLog("warn", "Pro payment-tx rate limit exceeded", { requestId });
      return jsonNoStore(
        {
          success: false,
          error: "Rate limit exceeded",
          meta: { requestId, retryAfter: 60 },
        },
        { status: 429, requestId }
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
    const bodySizeValidation = validateBodySize(raw, 2 * 1024);
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

    const { payerPublicKey } = body;
    if (!payerPublicKey || typeof payerPublicKey !== "string") {
      return jsonNoStore(
        { success: false, error: "Missing or invalid payerPublicKey" },
        { status: 400, requestId }
      );
    }

    // Validate payer public key
    const payerValidation = validatePublicKey(payerPublicKey);
    if (!payerValidation.valid) {
      return jsonNoStore(
        { success: false, error: payerValidation.error || "Invalid payerPublicKey" },
        { status: 400, requestId }
      );
    }

    const feesConfig = getFeesConfigFromEnv();

    // Check if Pro Scan is enabled
    if (!feesConfig.proScanEnabled) {
      return jsonNoStore(
        { success: false, error: "Pro Scan is not enabled" },
        { status: 403, requestId }
      );
    }

    // Validate OPS wallet
    if (!feesConfig.opsWallet) {
      return jsonNoStore(
        { success: false, error: "Pro Scan not configured (missing OPS wallet)" },
        { status: 500, requestId }
      );
    }

    // Build transaction instruction data
    // This is a simplified version - in production, you'd use @solana/web3.js
    // For now, we return the parameters needed for the client to build the transaction
    const transactionParams = {
      fromPubkey: payerValidation.sanitized!,
      toPubkey: feesConfig.opsWallet,
      lamports: Number(feesConfig.proScanLamports),
    };

    const elapsedMs = Date.now() - startTime;

    return jsonNoStore(
      {
        success: true,
        response: {
          transactionParams,
          // Instructions for client to build transaction:
          // 1. Create SystemProgram.transfer instruction
          // 2. Add to transaction
          // 3. Sign with wallet
          // 4. Send and get signature
          instruction: {
            programId: "11111111111111111111111111111111", // System Program
            keys: [
              { pubkey: transactionParams.fromPubkey, isSigner: true, isWritable: true },
              { pubkey: transactionParams.toPubkey, isSigner: false, isWritable: true },
            ],
            data: Buffer.from([
              2, // SystemProgram transfer instruction discriminator
              ...Buffer.from(transactionParams.lamports.toString(16).padStart(16, "0"), "hex"),
            ]).toString("base64"),
          },
        },
        meta: { requestId, elapsedMs },
      },
      { requestId }
    );
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    safeLog("error", "Pro payment-tx error", { requestId, error: err?.message });
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

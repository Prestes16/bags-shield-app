import { NextRequest } from "next/server";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";
import { getFeesConfigFromEnv, validateSolanaAddressBase58 } from "@/lib/fees";
import {
  validateContentType,
  validateBodySize,
  rateLimitMiddleware,
  safeLog,
  getSecurityHeaders,
} from "@/lib/security";
import {
  getClientIp,
  enforceJson,
  readJsonWithLimit,
  rateLimit as rateLimitHelper,
  jsonOk,
  jsonErr,
} from "@/lib/http-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/pro/verify
 * Verify Pro Scan payment transaction
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  const startTime = Date.now();
  
  // Track if we have a valid signature (for error handling)
  let hasValidSignature = false;
  let trimmedSignatureForError: string | null = null;
  let expectedAmountForError: bigint | null = null;

  try {
    // Enforce JSON Content-Type
    const jsonValidation = enforceJson(req);
    if (!jsonValidation.valid) {
      return jsonErr(400, jsonValidation.error || "Invalid Content-Type", { requestId });
    }

    // Rate limiting: 60 requests per minute
    const clientIP = getClientIp(req);
    const rateLimitResult = rateLimitHelper(clientIP, "pro_verify", 60, 60_000);
    if (!rateLimitResult.allowed) {
      safeLog("warn", "Pro verify rate limit exceeded", {
        requestId,
        ip: clientIP,
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt,
      });
      return jsonErr(
        429,
        "Rate limit exceeded",
        {
          requestId,
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        }
      );
    }

    // Read JSON with size limit: 2KB
    let body: any;
    try {
      const result = await readJsonWithLimit(req, 2 * 1024);
      body = result.body;
    } catch (err: any) {
      const errorMsg = err?.message || "Invalid request body";
      if (errorMsg.includes("too large")) {
        return jsonErr(413, errorMsg, { requestId });
      }
      return jsonErr(400, errorMsg, { requestId });
    }

    // Validate body structure
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonErr(400, "Request body must be a JSON object", { requestId });
    }

    const { signature, expectedLamports } = body;
    
    // Only return 400 for truly malformed requests (missing, non-string, empty, or absurdly long)
    // After this point, if signature is present and reasonable, always return 200 with valid:false
    if (!signature) {
      return jsonErr(400, "Missing signature", { requestId });
    }
    
    if (typeof signature !== "string") {
      return jsonErr(400, "Signature must be a string", { requestId });
    }
    
    const trimmedSignature = signature.trim();
    if (trimmedSignature.length === 0) {
      return jsonErr(400, "Signature cannot be empty", { requestId });
    }
    
    // Absurdly long signature (> 200 chars) -> 400 to prevent abuse
    if (trimmedSignature.length > 200) {
      return jsonErr(400, "Signature too long", { requestId });
    }
    
    // Mark that we have a valid signature (present, string, non-empty, reasonable length)
    // This allows error handler to return 200 with valid:false instead of 500
    hasValidSignature = true;
    trimmedSignatureForError = trimmedSignature;
    
    // For invalid format (but reasonable length), we'll try to verify and return 200 with valid:false
    // This allows the API to be more forgiving while still providing clear feedback

    const feesConfig = getFeesConfigFromEnv();

    // Check if verify is enabled
    if (!feesConfig.proScanVerifyEnabled) {
      return jsonNoStore(
          {
            success: true,
            response: {
              valid: false,
              reason: "Pro Scan verification is disabled",
              signature: trimmedSignature || signature,
              lamports: Number(feesConfig.proScanLamports),
              destination: feesConfig.opsWallet,
            },
          },
        { requestId }
      );
    }

    // Validate OPS wallet - if missing, return 200 with valid:false (not 500)
    // This allows clients to handle configuration issues gracefully
    if (!feesConfig.opsWallet) {
      return jsonNoStore(
        {
          success: true,
          response: {
            valid: false,
            reason: "Pro Scan not configured (missing OPS wallet)",
            signature: trimmedSignature,
            lamports: 0, // expectedAmount may not be available in this branch
            destination: null,
          },
        },
        { requestId }
      );
    }

    const expectedAmount = expectedLamports
      ? BigInt(expectedLamports)
      : feesConfig.proScanLamports;
    
    // Store for error handling
    expectedAmountForError = expectedAmount;

    // Verify transaction on-chain
    const rpcUrl =
      // Unify RPC: prefer server-side SOLANA_RPC_URL, fallback to NEXT_PUBLIC_SOLANA_RPC_URL, then default
      process.env.SOLANA_RPC_URL ||
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com";

    try {
      // Use trimmed signature for RPC call
      const rpcResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [
            trimmedSignature,
            {
              encoding: "jsonParsed",
              maxSupportedTransactionVersion: 0,
            },
          ],
        }),
      });

      if (!rpcResponse.ok) {
        throw new Error(`RPC error: ${rpcResponse.status}`);
      }

      const rpcData = await rpcResponse.json();
      if (rpcData.error) {
        // Invalid signature (base58 decode failed, transaction not found, etc.) -> 200 with valid:false
        // This allows clients to handle invalid signatures gracefully without treating them as 400 errors
        const reason = rpcData.error.message?.includes("not found") 
          ? "Transaction not found" 
          : rpcData.error.message?.includes("Invalid") 
          ? "Invalid signature format" 
          : "Transaction verification failed";
        return jsonNoStore(
          {
            success: true,
            response: {
              valid: false,
              reason,
              signature: trimmedSignature,
              lamports: 0, // expectedAmount may not be available in this branch
              destination: feesConfig.opsWallet,
            },
          },
          { requestId }
        );
      }

      const tx = rpcData.result;
      if (!tx || !tx.meta) {
        return jsonNoStore(
          {
            success: true,
            response: {
              valid: false,
              reason: "Transaction metadata not available",
              signature: trimmedSignature,
              lamports: 0, // expectedAmount may not be available in this branch
              destination: feesConfig.opsWallet,
            },
          },
          { requestId }
        );
      }

      // Check transaction status
      if (tx.meta.err !== null) {
        return jsonNoStore(
          {
            success: true,
            response: {
              valid: false,
              reason: `Transaction failed: ${JSON.stringify(tx.meta.err)}`,
              signature: trimmedSignature,
              lamports: 0, // expectedAmount may not be available in this branch
              destination: feesConfig.opsWallet,
            },
          },
          { requestId }
        );
      }

      // Check for SystemProgram transfer to OPS wallet
      const instructions = tx.transaction?.message?.instructions || [];
      let foundTransfer = false;
      let transferAmount = BigInt(0);

      for (const ix of instructions) {
        if (
          ix.program === "system" &&
          ix.parsed?.type === "transfer" &&
          ix.parsed?.info?.destination === feesConfig.opsWallet
        ) {
          foundTransfer = true;
          transferAmount = BigInt(ix.parsed.info.lamports || 0);
          break;
        }
      }

      if (!foundTransfer) {
        return jsonNoStore(
          {
            success: true,
            response: {
              valid: false,
              reason: `No transfer found to OPS wallet ${feesConfig.opsWallet}`,
              signature: trimmedSignature,
              lamports: 0, // expectedAmount may not be available in this branch
              destination: feesConfig.opsWallet,
            },
          },
          { requestId }
        );
      }

      if (transferAmount < expectedAmount) {
        return jsonNoStore(
          {
            success: true,
            response: {
              valid: false,
              reason: `Insufficient payment: expected ${expectedAmount.toString()}, got ${transferAmount.toString()}`,
              signature: trimmedSignature,
              lamports: Number(transferAmount),
              destination: feesConfig.opsWallet,
            },
          },
          { requestId }
        );
      }

      // All checks passed
      const elapsedMs = Date.now() - startTime;
      return jsonNoStore(
        {
          success: true,
          response: {
            valid: true,
            signature: trimmedSignature,
            lamports: Number(transferAmount),
            destination: feesConfig.opsWallet,
          },
          meta: { requestId, elapsedMs },
        },
        { requestId }
      );
    } catch (rpcErr: any) {
      safeLog("error", "RPC verification error", { requestId, error: rpcErr?.message });
      // RPC error (network, decode, etc.) -> 200 with valid:false (not 400)
      // This allows clients to distinguish between malformed requests (400) and verification failures (200 valid:false)
      return jsonNoStore(
        {
          success: true,
          response: {
            valid: false,
            reason: rpcErr?.message?.includes("fetch") || rpcErr?.message?.includes("network")
              ? "RPC network error"
              : "Invalid signature or transaction not found",
            signature: trimmedSignature,
            lamports: 0, // expectedAmount may not be available in this branch
            destination: feesConfig.opsWallet,
          },
        },
        { requestId }
      );
    }
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    safeLog("error", "Pro verify error", { requestId, error: err?.message });
    
    // If we have a valid signature (present, string, non-empty, reasonable length),
    // return 200 with valid:false instead of 500
    // This ensures predictable behavior: signature present + reasonable size -> always 200
    if (hasValidSignature && trimmedSignatureForError) {
      try {
        const feesConfig = getFeesConfigFromEnv();
        return jsonNoStore(
          {
            success: true,
            response: {
              valid: false,
              reason: "Verification unavailable",
              signature: trimmedSignatureForError,
              lamports: Number(expectedAmountForError || feesConfig.proScanLamports),
              destination: feesConfig.opsWallet || null,
            },
            meta: { requestId, elapsedMs },
          },
          { requestId }
        );
      } catch (configErr: any) {
        // Even if fees config fails, return 200 with valid:false (not 500)
        // This prevents 500 errors when signature is valid but something else fails
        return jsonNoStore(
          {
            success: true,
            response: {
              valid: false,
              reason: "Verification unavailable",
              signature: trimmedSignatureForError,
              lamports: Number(expectedAmountForError || BigInt(100000)),
              destination: null,
            },
            meta: { requestId, elapsedMs },
          },
          { requestId }
        );
      }
    }

    // If no valid signature, return 400 (malformed request)
    // This covers cases like JSON parse errors, missing signature, etc.
    return jsonNoStore(
      {
        success: false,
        error: "Invalid request",
        meta: { requestId, elapsedMs },
      },
      { status: 400, requestId }
    );
  }
}

import { NextRequest } from "next/server";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";
import { webacyHolderAnalysis } from "@/lib/webacy";
import { validateMint } from "@/lib/security";
import { getClientIp, rateLimit as rateLimitHelper, jsonErr } from "@/lib/http-guard";
import { safeLog } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dd/holder-analysis?mint=<base58>
 * Get holder analysis data from Webacy Data Driven API
 */
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  const startTime = Date.now();

  try {
    // Rate limiting: 60 requests per minute
    const clientIP = getClientIp(req);
    const rateLimitResult = rateLimitHelper(clientIP, "dd_holder_analysis", 60, 60_000);
    if (!rateLimitResult.allowed) {
      safeLog("warn", "DD holder-analysis rate limit exceeded", {
        requestId,
        ip: clientIP,
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt,
      });
      return jsonErr(
        429,
        "Rate limit exceeded. Please wait a moment before trying again.",
        {
          requestId,
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        }
      );
    }

    // Get mint and chain from query params
    const { searchParams } = new URL(req.url);
    const mint = searchParams.get("mint");
    const chain = searchParams.get("chain") || "sol"; // Default to "sol"

    if (!mint) {
      return jsonErr(400, "Missing required parameter: mint", { requestId });
    }

    // Validate mint format (basic base58 length 32-44)
    const mintValidation = validateMint(mint);
    if (!mintValidation.valid) {
      return jsonErr(400, mintValidation.error || "Invalid mint address format", { requestId });
    }

    const sanitizedMint = mintValidation.sanitized!;

    // Call Webacy API
    const result = await webacyHolderAnalysis(sanitizedMint, chain);

    // Handle restricted/premium (402/403) - transform to HTTP 200 with LOCKED state
    if (!result.success && result.restricted && (result.status === 402 || result.status === 403)) {
      return jsonNoStore(
        {
          success: true,
          response: {
            holderAnalysis: null,
            available: false,
          },
          meta: {
            provider: "webacy",
            restricted: true,
            reason: "premium",
            upstreamStatus: result.status,
            cached: false,
            requestId,
          },
        },
        { status: 200, requestId }
      );
    }

    if (!result.success) {
      // Build error response with upstream status
      const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
      const errorMeta: Record<string, unknown> = {
        provider: "webacy",
        upstreamStatus: result.status,
        cached: false,
      };

      // Add debug info only in development (never include secrets)
      if (isDev) {
        errorMeta.requestId = requestId;
      }

      // Handle specific error cases
      if (result.status === 412) {
        // WEBACY_ENABLED=0
        return jsonNoStore(
          {
            success: false,
            error: result.error,
            meta: errorMeta,
          },
          { status: 412, requestId }
        );
      }

      if (result.status === 500) {
        // Missing API key
        safeLog("error", "Webacy API key not configured", { requestId });
        return jsonNoStore(
          {
            success: false,
            error: "Webacy integration not configured",
            meta: { ...errorMeta, upstreamStatus: 503 },
          },
          { status: 503, requestId }
        );
      }

      // Other errors (400, 502, etc.) - return controlled error with upstream status
      return jsonNoStore(
        {
          success: false,
          error: result.error,
          meta: errorMeta,
        },
        { status: result.status || 502, requestId }
      );
    }

    // Success
    return jsonNoStore(
      {
        success: true,
        response: {
          holderAnalysis: result.data,
        },
        meta: {
          cached: result.cached || false,
          provider: "webacy",
        },
      },
      { requestId }
    );
  } catch (err: any) {
    // Log full error in dev, sanitized in prod
    const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
    safeLog("error", "DD holder-analysis error", {
      requestId,
      error: err?.message,
      ...(isDev && { stack: err?.stack?.split("\n")[0] }),
    });

    // Return controlled error response (never generic "Internal server error")
    const errorMeta: Record<string, unknown> = {
      provider: "webacy",
      cached: false,
    };

    if (isDev) {
      errorMeta.requestId = requestId;
      errorMeta.debug = err?.message || "Unknown error";
    }

    return jsonNoStore(
      {
        success: false,
        error: isDev ? `Internal error: ${err?.message || "Unknown"}` : "Webacy API request failed",
        meta: errorMeta,
      },
      { status: 500, requestId }
    );
  }
}

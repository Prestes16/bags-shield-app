import { NextRequest } from "next/server";
import { heliusDasBatch } from "@/lib/helius";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isBase58Pubkey(s: string): boolean {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (t.length < 32 || t.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t);
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  const MAX_BODY_SIZE = 50 * 1024; // 50KB max body size

  // Rate limiting: 30 batch requests per minute per IP
  const clientId = getClientIdentifier(req);
  const rateLimit = checkRateLimit(`batch:${clientId}`, {
    windowMs: 60_000,
    maxRequests: 30,
  });

  if (!rateLimit.allowed) {
    return jsonNoStore(
      {
        success: false,
        error: "Rate limit exceeded. Please try again later.",
      },
      {
        status: 429,
        requestId,
      }
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return jsonNoStore(
        { success: false, error: "Content-Type must be application/json" },
        { status: 400, requestId }
      );
    }

    // Read body with size limit (prevent DoS)
    const rawBody = await req.text().catch(() => "");
    if (rawBody.length > MAX_BODY_SIZE) {
      return jsonNoStore(
        { success: false, error: `Request body too large (max ${MAX_BODY_SIZE} bytes)` },
        { status: 413, requestId }
      );
    }

    let body: any = null;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonNoStore(
        { success: false, error: "Invalid JSON body" },
        { status: 400, requestId }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonNoStore(
        { success: false, error: "Body must be an object" },
        { status: 400, requestId }
      );
    }

    // Prevent prototype pollution
    if (Object.getPrototypeOf(body) !== Object.prototype) {
      return jsonNoStore(
        { success: false, error: "Invalid body structure" },
        { status: 400, requestId }
      );
    }

    const ids = Array.isArray(body.ids) ? body.ids : body.mints || [];
    if (!Array.isArray(ids)) {
      return jsonNoStore(
        { success: false, error: "ids or mints must be an array" },
        { status: 400, requestId }
      );
    }

    if (ids.length === 0) {
      return jsonNoStore(
        { success: false, error: "Provide an array of ids or mints" },
        { status: 400, requestId }
      );
    }

    // Early limit check (before processing)
    if (ids.length > 100) {
      return jsonNoStore(
        { success: false, error: "Array too large (max 100 items before filtering)" },
        { status: 400, requestId }
      );
    }

    const validIds = ids
      .map((id: any) => String(id || "").trim())
      .filter((id: string) => isBase58Pubkey(id));

    if (validIds.length === 0) {
      return jsonNoStore(
        { success: false, error: "No valid base58 pubkeys provided" },
        { status: 400, requestId }
      );
    }

    const result = await heliusDasBatch(validIds);

    if (!result.success) {
      return jsonNoStore(result, { status: 500, requestId });
    }

    return jsonNoStore(
      {
        success: true,
        response: result.data,
      },
      { requestId }
    );
  } catch (err: any) {
    return jsonNoStore(
      { success: false, error: err?.message || "Batch request failed" },
      { status: 500, requestId }
    );
  }
}

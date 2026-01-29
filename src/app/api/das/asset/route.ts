import { NextRequest } from "next/server";
import { heliusDas } from "@/lib/helius";
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

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  
  // Rate limiting: 120 requests per minute per IP
  const clientId = getClientIdentifier(req);
  const rateLimit = checkRateLimit(`asset:${clientId}`, {
    windowMs: 60_000,
    maxRequests: 120,
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

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();

  if (!id || !isBase58Pubkey(id)) {
    return jsonNoStore(
      {
        success: false,
        error: "Invalid id. Provide a valid base58 pubkey.",
      },
      { status: 400, requestId }
    );
  }

  const result = await heliusDas(id);

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
}

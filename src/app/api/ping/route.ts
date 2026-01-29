import { NextRequest } from "next/server";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  return jsonNoStore(
    {
      ok: true,
      message: "API routes are working",
      timestamp: Date.now(),
    },
    { requestId }
  );
}

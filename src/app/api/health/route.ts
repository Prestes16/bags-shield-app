import { NextRequest } from "next/server";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  return jsonNoStore(
    {
      success: true,
      response: {
        ok: true,
        ts: new Date().toISOString(),
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      },
    },
    { requestId }
  );
}

export async function HEAD(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  return new Response(null, {
    status: 200,
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-request-id": requestId,
    },
  });
}

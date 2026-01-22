export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    message: "API routes are working",
    timestamp: Date.now(),
  });
}

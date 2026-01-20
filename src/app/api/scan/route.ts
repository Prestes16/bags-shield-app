import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get("mint");

  if (!mint) {
    return NextResponse.json({ success: false, error: "missing mint" }, { status: 400 });
  }

  const base = process.env.SHIELD_API_BASE || "https://bags-shield-api.vercel.app";
  const upstream = `${base}/api/scan?mint=${encodeURIComponent(mint)}`;

  const r = await fetch(upstream, { cache: "no-store" });
  const text = await r.text();

  // repassa como veio (JSON ou erro), sem inventar nada
  return new NextResponse(text, {
    status: r.status,
    headers: {
      "Content-Type": r.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}

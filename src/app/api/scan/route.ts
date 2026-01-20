import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = (process.env.SHIELD_API_BASE || "").replace(/\/+$/, "");
const NO_STORE = { "cache-control": "no-store" };

function json(status: number, payload: any) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!UPSTREAM) return json(500, { success: false, error: "SHIELD_API_BASE não configurado" });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: "JSON inválido" });
  }

  const mint = typeof body?.mint === "string" ? body.mint.trim() : "";
  if (!mint) return json(400, { success: false, error: "mint é obrigatório" });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);

  try {
    const r = await fetch(`${UPSTREAM}/api/scan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({ ...body, mint }),
      cache: "no-store",
      signal: ac.signal,
    });

    const ct = r.headers.get("content-type") || "";
    const text = await r.text();

    // tenta manter o JSON do upstream como está
    if (ct.includes("application/json")) {
      try {
        return json(r.status, JSON.parse(text));
      } catch {
        return new NextResponse(text, { status: r.status, headers: { ...NO_STORE, "content-type": ct } });
      }
    }

    return new NextResponse(text, { status: r.status, headers: { ...NO_STORE, "content-type": ct || "text/plain" } });
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "timeout no upstream" : "falha ao chamar upstream";
    return json(502, { success: false, error: msg });
  } finally {
    clearTimeout(timer);
  }
}

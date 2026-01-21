import { NextResponse } from "next/server";

export const runtime = "nodejs";

function mkRequestId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function withHeaders(res: NextResponse, requestId: string) {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Request-Id", requestId);
  // CORS (não afeta irm/curl, mas ajuda demo pública)
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Request-Id");
  return res;
}

function json(status: number, body: any, requestId: string) {
  return withHeaders(NextResponse.json(body, { status }), requestId);
}

function validateMint(mint: string) {
  const issues: Array<{ path: string; message: string }> = [];
  const m = (mint || "").trim();

  if (!m) issues.push({ path: "mint", message: "missing" });
  // base58 (sem 0,O,I,l) e tamanho típico solana (32–44)
  if (m && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m)) {
    issues.push({ path: "mint", message: "invalid base58 (expected 32–44 chars)" });
  }
  return { ok: issues.length === 0, mint: m, issues };
}

export function OPTIONS() {
  const requestId = mkRequestId();
  return withHeaders(new NextResponse(null, { status: 204 }), requestId);
}

export async function POST(req: Request) {
  const requestId = mkRequestId();

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return json(400, { success: false, error: "Unable to read request body", meta: { requestId } }, requestId);
  }

  if (!raw || !raw.trim()) {
    return json(400, { success: false, error: "Empty JSON body", issues: [{ path: "", message: "body required" }], meta: { requestId } }, requestId);
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { success: false, error: "Invalid JSON body", meta: { requestId } }, requestId);
  }

  const { ok, mint, issues } = validateMint(body?.mint);
  if (!ok) {
    return json(400, { success: false, error: "Invalid request", issues, meta: { requestId } }, requestId);
  }

  // Stub realista (por enquanto). Depois trocamos por proxy pro motor v0.
  return json(200, {
    success: true,
    response: {
      mint,
      shieldScore: 80,
      grade: "B",
      badges: [
        { id: "authorities", label: "Authorities", level: "ok" },
        { id: "liquidity", label: "Liquidity", level: "attention" },
        { id: "trading", label: "Trading", level: "ok" }
      ],
      summary: "Stub scan OK (swap to real engine next)."
    },
    meta: { requestId, source: "stub" }
  }, requestId);
}

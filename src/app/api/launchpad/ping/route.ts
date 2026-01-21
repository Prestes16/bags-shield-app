import { NextResponse } from "next/server";

export const runtime = "nodejs";

function mkRequestId() {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );
  res.headers.set("X-XSS-Protection", "1; mode=block");

  // Só reforça em produção (Vercel já seta HSTS global, mas ok manter)
  if ((process.env.VERCEL_ENV || "").toLowerCase() === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

function withCommonHeaders(res: NextResponse, requestId: string) {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Request-Id", requestId);

  // CORS (demo pública)
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Request-Id");

  return applySecurityHeaders(res);
}

function json(status: number, body: any, requestId: string) {
  return withCommonHeaders(NextResponse.json(body, { status }), requestId);
}

function isEnabled() {
  return (process.env.LAUNCHPAD_ENABLED || "").trim().toLowerCase() === "true";
}

function getMode() {
  const m = (process.env.LAUNCHPAD_MODE || "stub").trim().toLowerCase();
  return m === "real" ? "real" : "stub";
}

export function OPTIONS() {
  const requestId = mkRequestId();
  return withCommonHeaders(new NextResponse(null, { status: 204 }), requestId);
}

export async function GET() {
  const requestId = mkRequestId();
  const mode = getMode();

  if (!isEnabled()) {
    return json(
      503,
      { success: false, error: "FEATURE_DISABLED", meta: { requestId, mode } },
      requestId
    );
  }

  return json(
    200,
    { success: true, response: { ok: true, mode, ts: new Date().toISOString() }, meta: { requestId, mode } },
    requestId
  );
}

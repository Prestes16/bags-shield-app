/**
 * Generic proxy helper for forwarding requests to Bags Shield API backend
 */

import { validateBackendUrl } from "./urlValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Validate CORS origin (basic check)
 */
function isValidOrigin(origin: string): boolean {
  if (!origin || typeof origin !== "string") return false;
  try {
    const url = new URL(origin);
    // Only allow http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    // Block localhost/internal IPs in production
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("192.168.")) {
      // Allow localhost only in development
      return process.env.NODE_ENV === "development";
    }
    return true;
  } catch {
    return false;
  }
}

function jsonError(status: number, error: string, detail?: string) {
  const payload: { success: false; error: string; detail?: string } = { success: false, error };
  if (detail) payload.detail = detail;
  return Response.json(payload, { status, headers: { "cache-control": "no-store" } });
}

function buildUpstreamUrl(req: Request, base: string, backendPath: string) {
  const incoming = new URL(req.url);

  // Preserva query string do request original
  let path = backendPath;
  if (incoming.search) {
    if (path.includes("?")) path += "&" + incoming.search.slice(1);
    else path += incoming.search;
  }

  // Base pode vir com ou sem barra final
  const baseClean = base.endsWith("/") ? base.slice(0, -1) : base;

  // Garante path começando com "/"
  const pathClean = path.startsWith("/") ? path : `/${path}`;

  return `${baseClean}${pathClean}`;
}

function pickForwardHeaders(req: Request): Headers {
  // Forward mínimo e seguro (sem repassar lixo de hop-by-hop)
  const out = new Headers();
  const keep = [
    "accept",
    "content-type",
    "authorization",
    "x-request-id",
    "x-correlation-id",
    "x-api-key",
    "accept-language",
  ];

  for (const k of keep) {
    const v = req.headers.get(k);
    if (v) out.set(k, v);
  }

  // Gera x-request-id se não vier no request
  if (!out.has("x-request-id")) {
    try {
      out.set("x-request-id", crypto.randomUUID());
    } catch {
      out.set("x-request-id", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    }
  }

  // Força no-store no proxy
  out.set("cache-control", "no-store");
  return out;
}

function filterHopByHopHeaders(upstreamHeaders: Headers): Headers {
  // Headers hop-by-hop que NÃO devem ser repassados
  const hopByHop = [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "content-length",
  ];

  const filtered = new Headers();

  // Repassa apenas headers úteis
  const allowed = [
    "content-type",
    "x-request-id",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "retry-after",
  ];

  // Itera sobre headers usando forEach (compatível com TypeScript)
  upstreamHeaders.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    // Pula hop-by-hop
    if (hopByHop.includes(lowerKey)) return;
    // Repassa se estiver na allowlist ou começar com x-ratelimit-
    if (allowed.includes(lowerKey) || lowerKey.startsWith("x-ratelimit-")) {
      filtered.set(key, value);
    }
  });

  // Força cache-control: no-store sempre
  filtered.set("cache-control", "no-store");

  return filtered;
}

export async function forwardToBackend(
  req: Request,
  backendPath: string,
  opts?: { timeoutMs?: number }
) {
  const base = process.env.BAGS_SHIELD_API_BASE;
  if (!base) {
    return jsonError(501, "MISSING_BAGS_SHIELD_API_BASE");
  }

  // SSRF Protection: validate backend URL
  const urlValidation = validateBackendUrl(base, { kind: "backend" });
  if (!urlValidation.valid) {
    return jsonError(400, "INVALID_BACKEND_URL", urlValidation.error);
  }
  
  // Use normalized URL if available
  const validatedBase = urlValidation.normalized || base;

  const method = (req.method || "GET").toUpperCase();

  // OPTIONS: responde rápido
  if (method === "OPTIONS") {
    const origin = req.headers.get("origin") || "";
    const allowOrigin = origin && isValidOrigin(origin) ? origin : "";

    const headers = new Headers();
    headers.set("cache-control", "no-store, no-cache, must-revalidate");
    headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
    headers.set("access-control-allow-headers", "content-type, authorization, x-request-id, x-api-key");
    headers.set("access-control-allow-credentials", "false");
    headers.set("access-control-max-age", "600");

    // ✅ Só seta allow-origin se a origem for válida.
    // ❌ Se inválida: NÃO envia header nenhum (nada de "null" e nada de "*")
    if (allowOrigin) {
      headers.set("access-control-allow-origin", allowOrigin);
      headers.set("vary", "Origin");
    }

    return new Response(null, { status: 204, headers });
  }

  const url = buildUpstreamUrl(req, validatedBase, backendPath);
  const headers = pickForwardHeaders(req);

  const ac = new AbortController();
  const timeoutMs = Math.max(1000, opts?.timeoutMs ?? 20000);
  const t = setTimeout(() => ac.abort(), timeoutMs);

  let body: string | undefined = undefined;
  if (!["GET", "HEAD"].includes(method)) {
    try {
      body = await req.text();
    } catch (error) {
      clearTimeout(t);
      return jsonError(400, "BAD_REQUEST", "Failed to read request body");
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body,
      redirect: "manual", // ✅ CRÍTICO: bloqueia redirects SSRF
      signal: ac.signal,
      cache: "no-store" as any,
    });

    // ✅ Se backend tentar redirecionar, a gente bloqueia.
    if (upstream.status >= 300 && upstream.status < 400) {
      clearTimeout(t);
      return jsonError(502, "BACKEND_REDIRECT_BLOCKED", "Backend redirect blocked for security");
    }
  } catch (e: any) {
    clearTimeout(t);
    const msg = e?.name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_FETCH_FAILED";
    return jsonError(502, msg, String(e?.message ?? e));
  } finally {
    clearTimeout(t);
  }

  // Repasse do response (status + body + headers filtrados)
  const buf = await upstream.arrayBuffer();
  const filteredHeaders = filterHopByHopHeaders(upstream.headers);

  // ✅ SEMPRE força cache-control: no-store (override do backend)
  filteredHeaders.set("cache-control", "no-store, no-cache, must-revalidate");

  // CORS: se tiver origem válida, adiciona headers CORS
  const origin = req.headers.get("origin") || "";
  const allowOrigin = origin && isValidOrigin(origin) ? origin : "";
  if (allowOrigin) {
    filteredHeaders.set("access-control-allow-origin", allowOrigin);
    filteredHeaders.set("vary", "Origin");
  }
  // Se origem inválida: NÃO setar allow-origin

  return new Response(buf, {
    status: upstream.status,
    headers: filteredHeaders,
  });
}

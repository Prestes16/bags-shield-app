/**
 * Generic proxy helper for forwarding requests to Bags Shield API backend
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const method = (req.method || "GET").toUpperCase();

  // OPTIONS: responde rápido
  if (method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin || "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type, authorization, x-request-id, x-api-key",
        "cache-control": "no-store",
      },
    });
  }

  const url = buildUpstreamUrl(req, base, backendPath);
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
      signal: ac.signal,
      cache: "no-store" as any,
    });
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

  return new Response(buf, {
    status: upstream.status,
    headers: filteredHeaders,
  });
}

import "server-only";
import { unstable_cache } from "next/cache";

type HeliusMeta = {
  calls: number;
  ms: number;
  cache: "hit" | "miss" | "stale";
  mode: "das" | "skipped" | "fail";
  error?: string;
};

type HeliusOk<T> = { success: true; data: T; meta: HeliusMeta };
type HeliusFail = { success: false; error: string; meta: HeliusMeta };
type HeliusResult<T> = HeliusOk<T> | HeliusFail;

const HELIUS_RPC_URL = (process.env.HELIUS_RPC_URL || "").trim(); // URL completa (com api-key se for o caso)
const HELIUS_TIMEOUT_MS = Number(process.env.HELIUS_TIMEOUT_MS ?? 6000);
const HELIUS_CACHE_TTL_S = Number(process.env.HELIUS_CACHE_TTL_S ?? 300);
const HELIUS_MAX_CALLS_PER_SCAN = Number(process.env.HELIUS_MAX_CALLS_PER_SCAN ?? 1);

function nowMs() {
  return Date.now();
}

// hash simples (FNV-1a 32-bit) pra chave curta de cache/dedupe
function hash32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

async function rpc<T>(
  method: string,
  params: any,
  bumpCall: () => void
): Promise<T> {
  if (!HELIUS_RPC_URL) throw new Error("HELIUS_RPC_URL not set");

  bumpCall();

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HELIUS_TIMEOUT_MS);

  try {
    const r = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
      cache: "no-store",
    });

    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Helius HTTP ${r.status}`);
    if (j?.error) throw new Error(`Helius RPC error: ${j.error.message || "unknown"}`);
    return j.result as T;
  } finally {
    clearTimeout(t);
  }
}

// Dedupe por chave dentro do mesmo runtime (reduz estouro em rajadas)
const inflight: Map<string, Promise<any>> = (globalThis as any).__heliusInflight
  || ((globalThis as any).__heliusInflight = new Map());

async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Cache "real" (Next data cache) por mint + TTL
export async function getAssetCached(mint: string, bumpCall: () => void) {
  const cachedFn = unstable_cache(
    async () => rpc<any>("getAsset", { id: mint }, bumpCall),
    [`helius:getAsset:${mint}`],
    { revalidate: HELIUS_CACHE_TTL_S }
  );
  return cachedFn();
}

// Cache "real" (Next data cache) por batch + TTL (chave curta)
async function getAssetBatchCached(ids: string[], bumpCall: () => void) {
  const joined = ids.join(",");
  const key = hash32(joined);

  const cachedFn = unstable_cache(
    async () => rpc<any>("getAssetBatch", { ids }, bumpCall),
    [`helius:getAssetBatch:${key}`],
    { revalidate: HELIUS_CACHE_TTL_S }
  );
  return cachedFn();
}

export type { HeliusMeta };

export function getHeliusPolicy() {
  return {
    enabled: !!HELIUS_RPC_URL,
    timeoutMs: HELIUS_TIMEOUT_MS,
    ttlS: HELIUS_CACHE_TTL_S,
    maxCallsPerScan: HELIUS_MAX_CALLS_PER_SCAN,
  };
}

// API "budgetada" (usada pelo scan)
export async function heliusGetAssetBudgeted(mint: string) {
  const meta: HeliusMeta = { calls: 0, ms: 0, cache: "miss", mode: "skipped" };
  const t0 = nowMs();

  const policy = getHeliusPolicy();
  if (!policy.enabled) {
    meta.mode = "skipped";
    meta.ms = nowMs() - t0;
    return { asset: null as any, meta };
  }

  try {
    let calls = 0;
    const bumpCall = () => {
      calls += 1;
      meta.calls = calls;
      if (calls > policy.maxCallsPerScan) throw new Error("Helius call budget exceeded");
    };

    const asset = await dedupe(`getAsset:${mint}`, async () => {
      return getAssetCached(mint, bumpCall);
    });

    meta.mode = "das";
    meta.ms = nowMs() - t0;
    return { asset, meta };
  } catch (e: any) {
    meta.mode = "fail";
    meta.error = e?.message || "Helius failed";
    meta.ms = nowMs() - t0;
    return { asset: null as any, meta };
  }
}

// =========================
// Compat: rotas /api/das/* esperam heliusDas/heliusDasBatch
// =========================
export async function heliusDas(id: string): Promise<HeliusResult<any>> {
  const { asset, meta } = await heliusGetAssetBudgeted(id);

  if (meta.mode === "skipped") {
    return { success: false, error: "Helius disabled (set HELIUS_RPC_URL)", meta };
  }
  if (meta.mode === "fail" || !asset) {
    return { success: false, error: meta.error || "Helius failed", meta };
  }
  return { success: true, data: asset, meta };
}

export async function heliusDasBatch(ids: string[]): Promise<HeliusResult<any>> {
  const meta: HeliusMeta = { calls: 0, ms: 0, cache: "miss", mode: "skipped" };
  const t0 = nowMs();

  const policy = getHeliusPolicy();
  if (!policy.enabled) {
    meta.mode = "skipped";
    meta.ms = nowMs() - t0;
    return { success: false, error: "Helius disabled (set HELIUS_RPC_URL)", meta };
  }

  try {
    let calls = 0;
    const bumpCall = () => {
      calls += 1;
      meta.calls = calls;
      // batch deve ser 1 call; se estourar, algo saiu do controle
      if (calls > Math.max(1, policy.maxCallsPerScan)) throw new Error("Helius call budget exceeded");
    };

    const key = hash32(ids.join(","));
    const data = await dedupe(`getAssetBatch:${key}`, async () => {
      return getAssetBatchCached(ids, bumpCall);
    });

    meta.mode = "das";
    meta.ms = nowMs() - t0;
    return { success: true, data, meta };
  } catch (e: any) {
    meta.mode = "fail";
    meta.error = e?.message || "Helius batch failed";
    meta.ms = nowMs() - t0;
    return { success: false, error: (meta.error ?? "Helius batch failed"), meta };
  }
}

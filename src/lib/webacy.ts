/**
 * Webacy API integration (Data Driven / DD)
 * Server-side only: never expose API keys to client
 */

export interface WebacyConfig {
  enabled: boolean;
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
}

export type WebacyResponse<T> =
  | {
      success: true;
      data: T;
      cached?: boolean;
    }
  | {
      success: false;
      error: string;
      status?: number;
      restricted?: boolean; // For 402/403 premium/locked responses
    };

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory cache (server-side only)
const cache = new Map<string, CacheEntry<any>>();
const MAX_CACHE_SIZE = 100;

// Negative cache for restricted/premium endpoints (402/403)
// Shorter TTL (30 minutes) to avoid wasting credits on repeated 403s
const NEGATIVE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const negativeCache = new Map<string, CacheEntry<{ restricted: true; status: number }>>();

/**
 * Get Webacy configuration from environment
 */
export function getWebacyConfig(): WebacyConfig {
  const enabled = process.env.WEBACY_ENABLED === "1" || process.env.WEBACY_ENABLED === "true";
  const apiKey = process.env.WEBACY_API_KEY?.trim() || null;
  const baseUrl = process.env.WEBACY_BASE_URL?.trim() || "https://api.webacy.com";
  const timeoutMs = parseInt(process.env.WEBACY_TIMEOUT_MS?.trim() || "10000", 10) || 10000;
  const cacheTtlMs = parseInt(process.env.WEBACY_CACHE_TTL_MS?.trim() || "300000", 10) || 300000; // 5 min default

  return {
    enabled,
    apiKey,
    baseUrl,
    timeoutMs,
    cacheTtlMs,
  };
}

/**
 * Validate mint address (base58, 32-44 chars)
 */
function validateMint(mint: string): boolean {
  if (typeof mint !== "string" || mint.length < 32 || mint.length > 44) {
    return false;
  }
  // Base58 validation (no 0, O, I, l)
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint.trim());
}

/**
 * Cleanup expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => cache.delete(key));

  // If still too large, remove oldest entries
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => cache.delete(key));
  }
}

/**
 * Get from cache
 */
function getCached<T>(key: string): T | null {
  cleanupCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Get from negative cache (for restricted/premium endpoints)
 */
function getNegativeCached(key: string): { restricted: true; status: number } | null {
  const now = Date.now();
  const entry = negativeCache.get(key);
  if (!entry) return null;
  if (now > entry.expiresAt) {
    negativeCache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Set negative cache entry (for restricted/premium endpoints)
 */
function setNegativeCache(key: string, status: number): void {
  // Cleanup expired entries first
  const now = Date.now();
  for (const [k, entry] of negativeCache.entries()) {
    if (now > entry.expiresAt) {
      negativeCache.delete(k);
    }
  }

  // Limit size
  if (negativeCache.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(negativeCache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = entries.slice(0, negativeCache.size - MAX_CACHE_SIZE + 1);
    toRemove.forEach(([k]) => negativeCache.delete(k));
  }

  negativeCache.set(key, {
    data: { restricted: true, status },
    expiresAt: now + NEGATIVE_CACHE_TTL_MS,
  });
}

/**
 * Set cache entry
 */
function setCache<T>(key: string, data: T, ttlMs: number): void {
  cleanupCache();
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Retry with bounded exponential backoff and Retry-After support
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeout?: number },
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Retry on 429 (rate limit) and 5xx (server errors)
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        if (attempt < maxRetries) {
          // Check for Retry-After header
          const retryAfter = response.headers.get("Retry-After");
          let delayMs: number;

          if (retryAfter) {
            const retryAfterSeconds = parseInt(retryAfter, 10);
            if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
              // Honor Retry-After, but cap at 60 seconds
              delayMs = Math.min(retryAfterSeconds * 1000, 60000);
            } else {
              // Invalid Retry-After, use exponential backoff
              delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), 30000);
            }
          } else {
            // No Retry-After, use exponential backoff (bounded)
            delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), 30000);
          }

          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue; // Retry
        }
      }

      return response;
    } catch (err: any) {
      lastError = err;
      if (err?.name === "AbortError") {
        // Timeout
        if (attempt < maxRetries) {
          const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), 30000);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      } else if (attempt < maxRetries) {
        // Other errors, retry with backoff
        const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), 30000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    }
  }

  throw lastError || new Error("Fetch failed after retries");
}

/**
 * Call Webacy API endpoint with path parameter
 * Returns standardized response with error handling and cache support
 */
async function callWebacyEndpoint<T = any>(
  endpoint: string,
  address: string,
  chain: string = "sol",
  useCache: boolean = true
): Promise<WebacyResponse<T>> {
  const config = getWebacyConfig();

  // Check if enabled
  if (!config.enabled) {
    return {
      success: false,
      error: "Webacy integration is disabled (WEBACY_ENABLED=0)",
      status: 412,
    };
  }

  // Check if API key is configured
  if (!config.apiKey) {
    return {
      success: false,
      error: "Webacy API key not configured (WEBACY_API_KEY missing)",
      status: 500,
    };
  }

  // Validate address format
  if (!validateMint(address)) {
    return {
      success: false,
      error: "Invalid mint address format",
      status: 400,
    };
  }

  // Normalize and validate chain (always default to "sol")
  const normalizedChain = (chain || "sol").toLowerCase().trim();
  if (normalizedChain !== "sol") {
    return {
      success: false,
      error: `Unsupported chain: ${normalizedChain}. Currently only 'sol' is supported.`,
      status: 400,
    };
  }

  // Check cache (include chain in cache key)
  const cacheKey = `webacy:${endpoint}:${normalizedChain}:${address}`;
  if (useCache) {
    // Check negative cache first (for restricted/premium endpoints)
    const negativeCached = getNegativeCached(cacheKey);
    if (negativeCached !== null) {
      return {
        success: false,
        error: "Premium feature - not available in demo",
        status: negativeCached.status,
        restricted: true,
      };
    }

    // Check positive cache
    const cached = getCached<T>(cacheKey);
    if (cached !== null) {
      return {
        success: true,
        data: cached,
        cached: true,
      };
    }
  }

  try {
    // Validate base URL format (prevent SSRF)
    let baseUrlObj: URL;
    try {
      baseUrlObj = new URL(config.baseUrl);
      if (baseUrlObj.protocol !== "https:" && baseUrlObj.protocol !== "http:") {
        return {
          success: false,
          error: "Invalid Webacy base URL protocol",
          status: 500,
        };
      }
    } catch {
      return {
        success: false,
        error: "Invalid Webacy base URL format",
        status: 500,
      };
    }

    // Build URL with path parameter and chain query param
    // Ensure no double slashes: endpoint should not start with /
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
    const url = new URL(`${cleanEndpoint}/${address}`, config.baseUrl);
    
    // Add chain as query parameter
    url.searchParams.set("chain", normalizedChain);

    // Ensure final URL is from same origin (prevent SSRF)
    if (url.origin !== baseUrlObj.origin) {
      return {
        success: false,
        error: "Invalid endpoint URL",
        status: 400,
      };
    }

    // Call Webacy API with retry
    const response = await fetchWithRetry(
      url.toString(),
      {
        method: "GET",
        headers: {
          "x-api-key": config.apiKey,
          "Accept": "application/json",
        },
        redirect: "manual", // Prevent SSRF
        timeout: config.timeoutMs,
      },
      3, // Max 3 retries
      1000 // Base delay 1s
    );

    // Handle non-OK responses
    if (!response.ok) {
      // Handle 402/403 as restricted/premium (not an error)
      if (response.status === 402 || response.status === 403) {
        // Cache negative result to avoid repeated API calls
        if (useCache) {
          setNegativeCache(cacheKey, response.status);
        }
        return {
          success: false,
          error: "Premium feature - not available in demo",
          status: response.status,
          restricted: true,
        };
      }

      // Other errors (429, 5xx, etc.)
      let errorMsg = `Webacy API error: ${response.status}`;
      try {
        const errorData = await response.json().catch(() => null);
        if (errorData?.message || errorData?.error) {
          errorMsg = errorData.message || errorData.error || errorMsg;
        }
      } catch {
        // Ignore JSON parse errors
      }

      return {
        success: false,
        error: errorMsg,
        status: response.status,
      };
    }

    // Parse JSON response
    const data = await response.json().catch(() => null);
    if (data === null) {
      return {
        success: false,
        error: "Invalid JSON response from Webacy API",
        status: 502,
      };
    }

    // Cache successful response
    if (useCache) {
      setCache(cacheKey, data, config.cacheTtlMs);
    }

    return {
      success: true,
      data: data as T,
      cached: false,
    };
  } catch (err: any) {
    // Network errors, timeouts, etc.
    const errorMsg = err?.message || "Webacy API request failed";
    return {
      success: false,
      error: errorMsg,
      status: 502,
    };
  }
}

/**
 * Get trading lite data for a mint
 */
export async function webacyTradingLite(mint: string, chain: string = "sol"): Promise<WebacyResponse<any>> {
  return callWebacyEndpoint("/trading-lite", mint, chain, true);
}

/**
 * Get holder analysis data for a mint
 */
export async function webacyHolderAnalysis(mint: string, chain: string = "sol"): Promise<WebacyResponse<any>> {
  return callWebacyEndpoint("/holder-analysis", mint, chain, true);
}

/**
 * Simple in-memory rate limiting (for development)
 * For production, use Redis or similar distributed store
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

function getKey(identifier: string, window: number): string {
  const windowStart = Math.floor(Date.now() / window);
  return `${identifier}:${windowStart}`;
}

export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  maxRequests?: number; // Max requests per window
  identifier?: string; // Optional identifier (IP, user ID, etc.)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Simple rate limiter (in-memory, single instance)
 * Returns true if request is allowed
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  // More lenient limits in development
  const isDev = process.env.NODE_ENV === "development";
  const windowMs = options.windowMs ?? 60_000; // Default 1 minute
  
  // Bypass rate limit completely for localhost/dev-client in development
  if (isDev && (identifier === "dev-client" || identifier.includes("localhost") || identifier === "127.0.0.1" || identifier === "::1")) {
    return {
      allowed: true,
      remaining: 999999,
      resetAt: Date.now() + windowMs,
    };
  }
  
  const maxRequests = isDev 
    ? (options.maxRequests ?? 100) * 10 // 10x more lenient in dev (default 1000 req/min)
    : (options.maxRequests ?? 60); // Default 60 req/min in production
  
  const key = getKey(identifier, windowMs);

  const now = Date.now();
  const entry = store[key];

  // Cleanup old entries (simple GC)
  if (Math.random() < 0.01) {
    // 1% chance to cleanup
    Object.keys(store).forEach((k) => {
      if (store[k].resetAt < now) {
        delete store[k];
      }
    });
  }

  if (!entry || entry.resetAt < now) {
    // New window or expired
    store[key] = {
      count: 1,
      resetAt: now + windowMs,
    };
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Validate if string is a valid IP address
 */
function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split(".").map(Number);
    return parts.every((p) => p >= 0 && p <= 255);
  }

  // IPv6 (simplified check)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  if (ipv6Regex.test(ip)) return true;

  // IPv6 compressed
  if (ip.includes("::")) {
    const parts = ip.split("::");
    if (parts.length === 2) {
      return parts.every((p) => /^([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/.test(p) || p === "");
    }
  }

  return false;
}

/**
 * Get client identifier from request (IP or custom header)
 * Works with both NextRequest and standard Request
 * Validates IPs to prevent invalid identifiers
 */
export function getClientIdentifier(req: { headers: Headers | { get: (key: string) => string | null } }): string {
  // Try X-Forwarded-For (first IP in chain)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp && isValidIP(firstIp)) {
      return firstIp;
    }
  }

  // Try CF-Connecting-IP (Cloudflare)
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && isValidIP(cfIp)) {
    return cfIp;
  }

  // Try X-Real-IP
  const realIp = req.headers.get("x-real-ip");
  if (realIp && isValidIP(realIp)) {
    return realIp;
  }

  // For development/localhost, use a consistent identifier
  // This prevents rate limiting issues in development
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return "dev-client";
  }

  // Fallback to a default identifier (not "unknown" to avoid collisions)
  return "default-client";
}

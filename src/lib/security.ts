/**
 * Security utilities for input validation, sanitization, and attack prevention
 */

import { NextRequest } from "next/server";
import { checkRateLimit, getClientIdentifier, RateLimitResult } from "./rate-limit";

/**
 * Input validation and sanitization
 */

/**
 * Validate and sanitize mint address (base58, 32-44 chars)
 */
export function validateMint(mint: unknown): { valid: boolean; sanitized?: string; error?: string } {
  if (typeof mint !== "string") {
    return { valid: false, error: "Mint must be a string" };
  }

  const trimmed = mint.trim();
  if (trimmed.length < 32 || trimmed.length > 44) {
    return { valid: false, error: "Invalid mint length" };
  }

  // Base58 validation (no 0, O, I, l)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
    return { valid: false, error: "Invalid mint format (must be base58)" };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate and sanitize public key
 */
export function validatePublicKey(pubkey: unknown): { valid: boolean; sanitized?: string; error?: string } {
  return validateMint(pubkey); // Same validation as mint
}

/**
 * Validate numeric string (for amounts, slippage, etc.)
 */
export function validateNumericString(
  value: unknown,
  options: { min?: number; max?: number; allowDecimals?: boolean } = {}
): { valid: boolean; sanitized?: string; error?: string } {
  if (typeof value !== "string") {
    return { valid: false, error: "Value must be a string" };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Value cannot be empty" };
  }

  // Prevent extremely long strings (DoS protection)
  if (trimmed.length > 100) {
    return { valid: false, error: "Value too long" };
  }

  const num = options.allowDecimals ? parseFloat(trimmed) : parseInt(trimmed, 10);

  if (isNaN(num)) {
    return { valid: false, error: "Invalid number format" };
  }

  if (options.min !== undefined && num < options.min) {
    return { valid: false, error: `Value must be >= ${options.min}` };
  }

  if (options.max !== undefined && num > options.max) {
    return { valid: false, error: `Value must be <= ${options.max}` };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate JSON body size (prevent DoS via large payloads)
 */
export function validateBodySize(body: string, maxBytes: number = 8 * 1024): { valid: boolean; error?: string } {
  if (body.length > maxBytes) {
    return { valid: false, error: `Body too large (max ${maxBytes} bytes)` };
  }
  return { valid: true };
}

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(input: unknown, maxLength: number = 1000): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim().slice(0, maxLength);
  // Remove potentially dangerous characters but keep base58/base64
  return trimmed.replace(/[<>\"']/g, "");
}

/**
 * Rate limiting middleware for Next.js API routes
 */
export async function rateLimitMiddleware(
  req: NextRequest,
  options: { windowMs?: number; maxRequests?: number } = {}
): Promise<{ allowed: boolean; result?: RateLimitResult; error?: string }> {
  try {
    const identifier = getClientIdentifier(req);
    const result = checkRateLimit(identifier, {
      windowMs: options.windowMs ?? 60_000, // 1 minute
      maxRequests: options.maxRequests ?? 60, // 60 requests per minute
    });

    if (!result.allowed) {
      return {
        allowed: false,
        result,
        error: "Rate limit exceeded",
      };
    }

    return { allowed: true, result };
  } catch (err: any) {
    // Fail open (don't block on rate limit errors)
    console.warn("[rate-limit] Error:", err?.message);
    return { allowed: true };
  }
}

/**
 * Validate Content-Type header
 */
export function validateContentType(
  contentType: string | null,
  required: string = "application/json"
): { valid: boolean; error?: string } {
  if (!contentType) {
    return { valid: false, error: "Missing Content-Type header" };
  }

  if (!contentType.includes(required)) {
    return { valid: false, error: `Content-Type must be ${required}` };
  }

  return { valid: true };
}

/**
 * Extract and validate IP from request
 */
export function getClientIP(req: NextRequest | { headers: Headers }): string {
  // Try X-Forwarded-For (first IP in chain)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp && isValidIP(firstIp)) return firstIp;
  }

  // Try CF-Connecting-IP (Cloudflare)
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && isValidIP(cfIp)) return cfIp;

  // Fallback
  return "unknown";
}

/**
 * Basic IP validation (IPv4 and IPv6)
 */
function isValidIP(ip: string): boolean {
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
 * Validate request body is valid JSON
 */
export function validateJSONBody(body: unknown): { valid: boolean; parsed?: any; error?: string } {
  if (typeof body === "object" && body !== null) {
    return { valid: true, parsed: body };
  }

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return { valid: true, parsed };
    } catch {
      return { valid: false, error: "Invalid JSON format" };
    }
  }

  return { valid: false, error: "Body must be JSON object or string" };
}

/**
 * Security headers for responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };
}

/**
 * Safe error logging (no secrets, no PII)
 */
export function safeLog(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>): void {
  const safeContext: Record<string, unknown> = {};

  if (context) {
    for (const [key, value] of Object.entries(context)) {
      // Never log sensitive fields
      const sensitiveKeys = ["password", "secret", "key", "token", "authorization", "private", "mnemonic"];
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        safeContext[key] = "[REDACTED]";
      } else {
        safeContext[key] = value;
      }
    }
  }

  const logMessage = `[${level.toUpperCase()}] ${message}`;
  if (Object.keys(safeContext).length > 0) {
    console[level](logMessage, safeContext);
  } else {
    console[level](logMessage);
  }
}

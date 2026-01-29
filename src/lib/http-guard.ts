/**
 * HTTP Guard: Security helpers for API routes
 * Consolidates IP extraction, JSON validation, body size limits, and rate limiting
 */

import { NextRequest } from "next/server";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { jsonNoStore, getRequestId } from "@/lib/api-helpers";

/**
 * Get client IP from request headers (x-forwarded-for, cf-connecting-ip, x-real-ip)
 * Returns first valid IP or fallback identifier
 */
export function getClientIp(req: NextRequest): string {
  return getClientIdentifier(req);
}

/**
 * Enforce JSON Content-Type
 * Returns validation result with error message if invalid
 */
export function enforceJson(req: NextRequest): { valid: boolean; error?: string } {
  const contentType = req.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  
  if (!isJson) {
    return {
      valid: false,
      error: `Invalid Content-Type. Expected application/json, got ${contentType || "missing"}`,
    };
  }
  
  return { valid: true };
}

/**
 * Read JSON body with size limit
 * Validates size before parsing to prevent DoS
 * Returns parsed JSON or throws error
 */
export async function readJsonWithLimit(
  req: NextRequest,
  maxBytes: number
): Promise<{ body: any; size: number }> {
  // Read raw text first
  const raw = await req.text();
  const size = Buffer.byteLength(raw, "utf8");
  
  // Check size before parsing
  if (size > maxBytes) {
    throw new Error(`Payload too large: ${size} bytes (max: ${maxBytes} bytes)`);
  }
  
  // Parse JSON
  try {
    const body = JSON.parse(raw);
    return { body, size };
  } catch (err: any) {
    throw new Error(`Invalid JSON: ${err?.message || "parse error"}`);
  }
}

/**
 * Rate limit helper
 * Uses in-memory store (best-effort, single instance)
 * Returns result with allowed flag and remaining requests
 */
export function rateLimit(
  ip: string,
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const identifier = `${key}:${ip}`;
  const result = checkRateLimit(identifier, {
    windowMs,
    maxRequests: limit,
  });
  
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };
}

/**
 * Success JSON response helper
 * Always includes no-store cache and X-Request-Id
 */
export function jsonOk(
  data: unknown,
  meta?: { requestId?: string; [key: string]: unknown }
): Response {
  const requestId = meta?.requestId || getRequestId(new Headers());
  return jsonNoStore(
    {
      success: true,
      response: data,
      ...(meta && { meta }),
    },
    { requestId }
  );
}

/**
 * Error JSON response helper
 * Always includes no-store cache and X-Request-Id
 */
export function jsonErr(
  status: number,
  message: string,
  meta?: { requestId?: string; [key: string]: unknown }
): Response {
  const requestId = meta?.requestId || getRequestId(new Headers());
  return jsonNoStore(
    {
      success: false,
      error: message,
      ...(meta && { meta }),
    },
    { status, requestId }
  );
}

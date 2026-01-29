/**
 * API route helpers for standardized headers and responses
 */

import { NextResponse } from "next/server";

function generateRequestId(): string {
  if (typeof globalThis?.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface ApiResponseOptions {
  status?: number;
  requestId?: string;
  headers?: Record<string, string>;
}

/**
 * Security headers (default for all API responses)
 */
function getDefaultSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };
}

/**
 * Create standardized JSON response with no-store cache and X-Request-Id
 */
export function jsonNoStore(
  body: unknown,
  options: ApiResponseOptions = {}
): NextResponse {
  const requestId = options.requestId || generateRequestId();
  const status = options.status || 200;

  // Merge security headers with custom headers
  const securityHeaders = getDefaultSecurityHeaders();
  const customHeaders = options.headers || {};
  const allHeaders = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "x-request-id": requestId,
    ...securityHeaders,
    ...customHeaders, // Custom headers override security headers if needed
  };

  return NextResponse.json(body, {
    status,
    headers: allHeaders,
  });
}

/**
 * Sanitize request ID (prevent injection/DoS via long IDs)
 */
function sanitizeRequestId(id: string): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  // UUID format or simple timestamp format
  // Max 100 chars to prevent DoS
  if (trimmed.length > 100) return null;
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Get or generate request ID from headers or generate new one
 */
export function getRequestId(headers: Headers): string {
  const existing = headers.get("x-request-id");
  if (existing) {
    const sanitized = sanitizeRequestId(existing);
    if (sanitized) return sanitized;
  }
  return generateRequestId();
}

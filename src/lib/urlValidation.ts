/**
 * URL validation and SSRF protection
 */

import { isIP } from "node:net";

type ValidateOpts = {
  kind?: "backend" | "rpc";
  allowHttpInDev?: boolean;
};

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local / metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // CGNAT 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const s = ip.toLowerCase();

  // loopback
  if (s === "::1") return true;

  // link-local fe80::/10
  if (s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb")) return true;

  // unique local fc00::/7 (fc** or fd**)
  if (s.startsWith("fc") || s.startsWith("fd")) return true;

  return false;
}

/**
 * Valida e normaliza URLs para evitar SSRF.
 * - backend: permite http/https
 * - rpc: força https (exceto dev, se allowHttpInDev)
 * Bloqueia userinfo, localhost, IP privado, link-local e metadata endpoints.
 * 
 * Retorna objeto compatível com código existente: { valid: boolean, error?: string }
 */
export function validateBackendUrl(
  raw: string,
  opts?: ValidateOpts
): { valid: boolean; error?: string; normalized?: string } {
  const kind = opts?.kind ?? "backend";
  const allowHttpInDev = opts?.allowHttpInDev ?? true;

  try {
    const input = (raw ?? "").trim();
    if (!input) {
      return { valid: false, error: "URL is required" };
    }

    // Normaliza: remove trailing slash e remove /api no final pra evitar /api/api
    let normalized = input.replace(/\/+$/, "");
    if (normalized.endsWith("/api")) normalized = normalized.slice(0, -4);

    let u: URL;
    try {
      u = new URL(normalized);
    } catch {
      return { valid: false, error: "Invalid URL format" };
    }

    // Bloqueia userinfo trick: https://user@169.254.169.254/
    if (u.username || u.password) {
      return { valid: false, error: "URL with userinfo not allowed" };
    }

    const proto = u.protocol.toLowerCase();

    if (kind === "rpc") {
      const isDev = process.env.NODE_ENV !== "production";
      const httpOk = isDev && allowHttpInDev;

      if (!(proto === "https:" || (httpOk && proto === "http:"))) {
        return { valid: false, error: "RPC URL must be HTTPS (or HTTP in dev)" };
      }
    } else {
      if (!(proto === "http:" || proto === "https:")) {
        return { valid: false, error: "Only http and https protocols are allowed" };
      }
    }

    const host = (u.hostname || "").toLowerCase();

    // Bloqueios óbvios
    if (!host) return { valid: false, error: "Invalid hostname" };
    if (host === "localhost" || host.endsWith(".localhost")) {
      return { valid: false, error: "Localhost not allowed" };
    }
    if (host === "0.0.0.0" || host === "127.0.0.1" || host === "::1") {
      return { valid: false, error: "Internal IP not allowed" };
    }

    // Metadata hostnames comuns
    if (host === "metadata.google.internal") {
      return { valid: false, error: "Metadata endpoint not allowed" };
    }

    const ipKind = isIP(host);
    if (ipKind === 4) {
      if (isPrivateIpv4(host)) {
        return { valid: false, error: "Private IPv4 range not allowed" };
      }
    } else if (ipKind === 6) {
      if (isPrivateIpv6(host)) {
        return { valid: false, error: "Private IPv6 range not allowed" };
      }
    }

    // Final: garante sem slash no fim
    const finalUrl = u.toString().replace(/\/+$/, "");
    return { valid: true, normalized: finalUrl };
  } catch (err: any) {
    return { valid: false, error: err?.message || "Invalid backend URL" };
  }
}

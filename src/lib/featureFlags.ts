/**
 * Feature flags system
 * All flags default to safe values (fail-closed)
 * Server-side only: never expose to client bundles
 */

export interface FeatureFlags {
  HELIUS_ENABLED: boolean;
  RPC_FALLBACK_ENABLED: boolean;
  LOCAL_CACHE_ENABLED: boolean;
  JUPITER_SWAP_ENABLED: boolean;
  WALLET_CONNECT_ENABLED: boolean;
  APP_FEE_ENABLED: boolean;
  APP_FEE_BPS: number;
  APP_FEE_WALLET_OPS: string | null;
  APP_FEE_WALLET_TREASURY: string | null;
  APP_FEE_PREFER_MINT: string | null;
  APP_FEE_FALLBACK_MINT: string | null;
  PRO_SCAN_ENABLED: boolean;
  PRO_SCAN_LAMPORTS: bigint;
  PRO_SCAN_VERIFY_ENABLED: boolean;
}

/**
 * Parse boolean env var (defaults to true for enabled flags, false for disabled)
 */
function parseBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value === null) return defaultValue;
  const lower = String(value).toLowerCase().trim();
  if (lower === "false" || lower === "0" || lower === "off" || lower === "no") return false;
  if (lower === "true" || lower === "1" || lower === "on" || lower === "yes") return true;
  return defaultValue;
}

/**
 * Parse integer env var with clamp
 */
function parseIntEnv(key: string, defaultValue: number, min: number, max: number): number {
  const value = process.env[key];
  if (value === undefined || value === null) return defaultValue;
  const parsed = parseInt(String(value).trim(), 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Parse base58 public key env var (validates format)
 */
function parsePublicKeyEnv(key: string, defaultValue: string | null): string | null {
  const value = process.env[key];
  if (!value || typeof value !== "string") return defaultValue;
  const trimmed = value.trim();
  // Basic base58 validation (32-44 chars, no 0, O, I, l)
  if (trimmed.length >= 32 && trimmed.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) {
    return trimmed;
  }
  return defaultValue;
}

/**
 * Get feature flags (server-side only)
 */
export function getFeatureFlags(): FeatureFlags {
  // Lazy import to avoid circular dependency
  let feesConfig: any;
  try {
    const feesModule = require("./fees");
    feesConfig = feesModule.getFeesConfigFromEnv();
  } catch {
    // Fallback if fees module not available
    feesConfig = {
      opsWallet: null,
      treasuryWallet: null,
      proScanEnabled: false,
      proScanLamports: BigInt(100000),
      proScanVerifyEnabled: false,
    };
  }

  // Force APP_FEE_ENABLED=false if OPS wallet is invalid/placeholder (fail-closed)
  const appFeeEnabledRaw = parseBoolEnv("APP_FEE_ENABLED", false);
  const appFeeEnabled = appFeeEnabledRaw && feesConfig.opsWallet ? true : false;

  return {
    HELIUS_ENABLED: parseBoolEnv("HELIUS_ENABLED", true),
    RPC_FALLBACK_ENABLED: parseBoolEnv("RPC_FALLBACK_ENABLED", true),
    LOCAL_CACHE_ENABLED: parseBoolEnv("LOCAL_CACHE_ENABLED", true),
    JUPITER_SWAP_ENABLED: parseBoolEnv("JUPITER_SWAP_ENABLED", false),
    WALLET_CONNECT_ENABLED: parseBoolEnv("WALLET_CONNECT_ENABLED", true),
    APP_FEE_ENABLED: appFeeEnabled, // Forced to false if wallet invalid
    APP_FEE_BPS: parseIntEnv("APP_FEE_BPS", 20, 0, 200), // 0-200 bps = 0-2%, default 20 (0.20%)
    APP_FEE_WALLET_OPS: feesConfig.opsWallet,
    APP_FEE_WALLET_TREASURY: feesConfig.treasuryWallet,
    APP_FEE_PREFER_MINT: parsePublicKeyEnv(
      "APP_FEE_PREFER_MINT",
      "So11111111111111111111111111111111111111112" // wSOL default
    ),
    APP_FEE_FALLBACK_MINT: parsePublicKeyEnv(
      "APP_FEE_FALLBACK_MINT",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC default
    ),
    PRO_SCAN_ENABLED: feesConfig.proScanEnabled,
    PRO_SCAN_LAMPORTS: feesConfig.proScanLamports,
    PRO_SCAN_VERIFY_ENABLED: feesConfig.proScanVerifyEnabled,
  };
}

/**
 * Check if a feature is enabled (only for boolean flags)
 */
export function isFeatureEnabled(flag: "HELIUS_ENABLED" | "RPC_FALLBACK_ENABLED" | "LOCAL_CACHE_ENABLED" | "JUPITER_SWAP_ENABLED" | "WALLET_CONNECT_ENABLED" | "APP_FEE_ENABLED" | "PRO_SCAN_ENABLED" | "PRO_SCAN_VERIFY_ENABLED"): boolean {
  const flags = getFeatureFlags();
  const value = flags[flag];
  return typeof value === "boolean" ? value : false;
}

/**
 * Client-side feature flags (safe subset, no secrets)
 * Exposed via API endpoint for client use
 */
export interface ClientFeatureFlags {
  LOCAL_CACHE_ENABLED: boolean;
  JUPITER_SWAP_ENABLED: boolean;
  WALLET_CONNECT_ENABLED: boolean;
  APP_FEE_ENABLED: boolean; // Safe to expose (just indicates if fee is enabled, not amounts)
}

/**
 * Get client-safe feature flags
 */
export function getClientFeatureFlags(): ClientFeatureFlags {
  const flags = getFeatureFlags();
  return {
    LOCAL_CACHE_ENABLED: flags.LOCAL_CACHE_ENABLED,
    JUPITER_SWAP_ENABLED: flags.JUPITER_SWAP_ENABLED,
    WALLET_CONNECT_ENABLED: flags.WALLET_CONNECT_ENABLED,
    APP_FEE_ENABLED: flags.APP_FEE_ENABLED,
  };
}

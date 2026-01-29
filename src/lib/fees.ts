/**
 * App fee resolution for Jupiter swaps
 * Determines if fee should be applied and calculates fee account
 * Also handles Pro Scan fees and general fee calculations
 */

import { validateMint, validatePublicKey } from "./security";
import { getFeatureFlags } from "./featureFlags";

/**
 * Validate Solana address (base58, 32-44 chars)
 */
export function validateSolanaAddressBase58(addr: unknown): { valid: boolean; sanitized?: string; error?: string } {
  return validatePublicKey(addr);
}

/**
 * Clamp number between min and max
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Calculate app fee in lamports
 * Formula: fee = clamp(base + amount*rateBps/10000, base, cap)
 */
export function calcAppFeeLamports(
  amountLamports: bigint,
  options: {
    baseLamports?: bigint;
    rateBps?: number;
    capLamports?: bigint;
  }
): bigint {
  const base = options.baseLamports ?? BigInt(0);
  const rateBps = options.rateBps ?? 0;
  const cap = options.capLamports ?? BigInt(Number.MAX_SAFE_INTEGER);

  if (rateBps <= 0) {
    return base;
  }

  // Calculate: base + amount * rateBps / 10000
  const rateMultiplier = BigInt(rateBps);
  const rateDivisor = BigInt(10000);
  const variableFee = (amountLamports * rateMultiplier) / rateDivisor;
  const totalFee = base + variableFee;

  // Clamp between base and cap
  return clamp(Number(totalFee), Number(base), Number(cap)) as unknown as bigint;
}

/**
 * Get fees configuration from environment variables
 */
export interface FeesConfig {
  opsWallet: string | null;
  treasuryWallet: string | null;
  appFeeBps: number; // 0-200 bps (0-2%)
  proScanLamports: bigint;
  proScanEnabled: boolean;
  proScanVerifyEnabled: boolean;
}

export function getFeesConfigFromEnv(): FeesConfig {
  try {
    // Parse wallets (base58 validation, strict 32-44 chars)
    const opsWalletRaw = process.env.APP_FEE_WALLET_OPS?.trim() || null;
    const treasuryWalletRaw = process.env.APP_FEE_WALLET_TREASURY?.trim() || null;

    // Validate wallets if provided (must be valid base58, 32-44 chars)
    let opsWallet: string | null = null;
    let treasuryWallet: string | null = null;

    if (opsWalletRaw) {
      try {
        const validation = validateSolanaAddressBase58(opsWalletRaw);
        if (validation.valid && validation.sanitized) {
          // Additional check: must be 32-44 chars (not placeholder)
          const sanitized = validation.sanitized;
          if (sanitized.length >= 32 && sanitized.length <= 44) {
            opsWallet = sanitized;
          }
        }
      } catch {
        // Invalid wallet, keep as null (fail-closed)
        opsWallet = null;
      }
    }

    if (treasuryWalletRaw) {
      try {
        const validation = validateSolanaAddressBase58(treasuryWalletRaw);
        if (validation.valid && validation.sanitized) {
          const sanitized = validation.sanitized;
          if (sanitized.length >= 32 && sanitized.length <= 44) {
            treasuryWallet = sanitized;
          }
        }
      } catch {
        // Invalid wallet, keep as null (fail-closed)
        treasuryWallet = null;
      }
    }

    // Parse APP_FEE_BPS (default 20, min 0, max 200)
    const appFeeBpsRaw = process.env.APP_FEE_BPS;
    let appFeeBps = 20; // Default fail-closed
    try {
      if (appFeeBpsRaw) {
        const parsed = parseInt(appFeeBpsRaw, 10);
        if (!isNaN(parsed)) {
          appFeeBps = clamp(parsed, 0, 200);
        }
      }
    } catch {
      // Fallback to default on any error
      appFeeBps = 20;
    }

    // Parse PRO_SCAN_LAMPORTS (default 100000, min 0, max 2000000 = 0.002 SOL)
    const proScanLamportsRaw = process.env.PRO_SCAN_LAMPORTS;
    let proScanLamports = BigInt(100000);
    try {
      if (proScanLamportsRaw) {
        const parsed = parseInt(proScanLamportsRaw, 10);
        if (!isNaN(parsed)) {
          proScanLamports = BigInt(clamp(parsed, 0, 2000000));
        }
      }
    } catch {
      // Fallback to default
      proScanLamports = BigInt(100000);
    }

    // Parse PRO_SCAN_ENABLED (default false)
    const proScanEnabledRaw = process.env.PRO_SCAN_ENABLED;
    const proScanEnabled =
      proScanEnabledRaw?.toLowerCase() === "true" ||
      proScanEnabledRaw === "1" ||
      proScanEnabledRaw === "on";

    // Parse PRO_SCAN_VERIFY_ENABLED (default true when PRO_SCAN_ENABLED is true)
    const proScanVerifyEnabledRaw = process.env.PRO_SCAN_VERIFY_ENABLED;
    const proScanVerifyEnabled =
      proScanVerifyEnabledRaw === undefined || proScanVerifyEnabledRaw === null
        ? proScanEnabled // Default to same as PRO_SCAN_ENABLED
        : proScanVerifyEnabledRaw.toLowerCase() === "true" ||
          proScanVerifyEnabledRaw === "1" ||
          proScanVerifyEnabledRaw === "on";

    // Determine if wallets are valid (not null and proper length)
    const opsValid = opsWallet !== null && opsWallet.length >= 32 && opsWallet.length <= 44;
    const treasuryValid = treasuryWallet !== null && treasuryWallet.length >= 32 && treasuryWallet.length <= 44;

    return {
      opsWallet: opsValid ? opsWallet : null,
      treasuryWallet: treasuryValid ? treasuryWallet : null,
      appFeeBps,
      proScanLamports,
      proScanEnabled,
      proScanVerifyEnabled: proScanVerifyEnabled && proScanEnabled, // Only enable verify if Pro Scan is enabled
    };
  } catch (err) {
    // Fail-closed: return safe defaults on any error
    return {
      opsWallet: null,
      treasuryWallet: null,
      appFeeBps: 20,
      proScanLamports: BigInt(100000),
      proScanEnabled: false,
      proScanVerifyEnabled: false,
    };
  }
}

/**
 * Explain fee in human-readable format
 */
export function explainFee(feeBps: number): string {
  if (feeBps === 0) return "No fee";
  const percentage = (feeBps / 100).toFixed(2);
  return `${percentage}% platform fee`;
}

export interface FeeResolutionParams {
  inputMint: string;
  outputMint: string;
  swapMode: "ExactIn" | "ExactOut";
  direction: "buy" | "sell";
}

export interface FeeResolutionResult {
  enabled: boolean;
  platformFeeBps: number;
  feeMint: string | null;
  feeWallet: string | null;
  feeAccount: string | null; // ATA address
}

/**
 * Get Associated Token Account address (ATA) for a wallet and mint
 * For v1, Jupiter will derive the ATA automatically from the wallet address
 * We return the wallet address directly (Jupiter handles ATA derivation)
 */
function getAssociatedTokenAddress(walletPubkey: string, mintPubkey: string): string | null {
  try {
    // V1: Return wallet address - Jupiter will derive ATA
    // In production with @solana/spl-token, you'd use:
    // getAssociatedTokenAddressSync(new PublicKey(mintPubkey), new PublicKey(walletPubkey))
    // For now, Jupiter API accepts wallet address and derives ATA
    return walletPubkey;
  } catch {
    return null;
  }
}

/**
 * Resolve app fee configuration for a swap
 */
export function resolveAppFeeForSwap(params: FeeResolutionParams): FeeResolutionResult {
  const flags = getFeatureFlags();

  // Default: fee disabled
  const defaultResult: FeeResolutionResult = {
    enabled: false,
    platformFeeBps: 0,
    feeMint: null,
    feeWallet: null,
    feeAccount: null,
  };

  // Rule 1: APP_FEE_ENABLED must be true
  if (!flags.APP_FEE_ENABLED) {
    return defaultResult;
  }

  // Rule 2: Clamp platformFeeBps (0-100 bps = 0-1%)
  const platformFeeBps = Math.max(0, Math.min(100, flags.APP_FEE_BPS));
  if (platformFeeBps === 0) {
    return defaultResult;
  }

  // Rule 3: Validate input/output mints
  const inputMintValidation = validateMint(params.inputMint);
  const outputMintValidation = validateMint(params.outputMint);
  if (!inputMintValidation.valid || !outputMintValidation.valid) {
    return defaultResult;
  }

  const inputMint = inputMintValidation.sanitized!;
  const outputMint = outputMintValidation.sanitized!;

  // Rule 4: Determine feeMint (must be in the swap pair)
  let feeMint: string | null = null;

  // Check if prefer mint (wSOL) is in the pair
  if (flags.APP_FEE_PREFER_MINT && (inputMint === flags.APP_FEE_PREFER_MINT || outputMint === flags.APP_FEE_PREFER_MINT)) {
    feeMint = flags.APP_FEE_PREFER_MINT;
  }
  // Check if fallback mint (USDC) is in the pair
  else if (flags.APP_FEE_FALLBACK_MINT && (inputMint === flags.APP_FEE_FALLBACK_MINT || outputMint === flags.APP_FEE_FALLBACK_MINT)) {
    feeMint = flags.APP_FEE_FALLBACK_MINT;
  }
  // No valid fee mint in pair
  else {
    return defaultResult;
  }

  // Rule 5: For ExactOut, feeMint must be inputMint (Jupiter restriction)
  if (params.swapMode === "ExactOut" && feeMint !== inputMint) {
    return defaultResult;
  }

  // Rule 6: V1 uses OPS wallet only (Treasury split is operational, not on-chain)
  // Future v2 can implement split logic
  let feeWallet: string | null = flags.APP_FEE_WALLET_OPS;

  // Validate fee wallet
  if (!feeWallet) {
    return defaultResult;
  }

  const feeWalletValidation = validatePublicKey(feeWallet);
  if (!feeWalletValidation.valid) {
    return defaultResult;
  }

  const validatedFeeWallet = feeWalletValidation.sanitized!;

  // Rule 7: Calculate fee account (ATA)
  const feeAccount = getAssociatedTokenAddress(validatedFeeWallet, feeMint);
  if (!feeAccount) {
    return defaultResult;
  }

  // All checks passed
  return {
    enabled: true,
    platformFeeBps,
    feeMint,
    feeWallet: validatedFeeWallet,
    feeAccount,
  };
}

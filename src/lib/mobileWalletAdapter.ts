/**
 * Solana Mobile Wallet Adapter (MWA) support
 * For Seeker/Saga/Seed Vault
 */

export interface MobileWalletAdapter {
  name: string;
  ready: boolean;
  publicKey: string | null;
  connected: boolean;
}

/**
 * Check if running on Solana Mobile device
 */
export function isSolanaMobile(): boolean {
  if (typeof window === "undefined") return false;
  
  // Check for Solana Mobile user agent
  const ua = navigator.userAgent || "";
  return /SolanaMobile/i.test(ua) || /Saga/i.test(ua) || /Seeker/i.test(ua);
}

/**
 * Check if MWA is available
 */
export function isMWAAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  
  // Check for MWA protocol
  return !!(
    w.solana?.isMobile ||
    w.solanaMobile ||
    w.navigator?.solanaMobile ||
    isSolanaMobile()
  );
}

/**
 * Get mobile wallet adapter
 */
export function getMobileWalletAdapter(): MobileWalletAdapter | null {
  if (!isMWAAvailable()) return null;

  const w = window as any;
  const provider = w.solana?.isMobile ? w.solana : w.solanaMobile || w.navigator?.solanaMobile;

  if (!provider) return null;

  return {
    name: "Solana Mobile (Seed Vault)",
    ready: true,
    publicKey: provider.publicKey?.toString() || null,
    connected: !!provider.publicKey,
  };
}

/**
 * Connect to mobile wallet
 */
export async function connectMobileWallet(): Promise<{ publicKey: string }> {
  if (!isMWAAvailable()) {
    throw new Error("Mobile wallet adapter not available");
  }

  const w = window as any;
  const provider = w.solana?.isMobile ? w.solana : w.solanaMobile || w.navigator?.solanaMobile;

  if (!provider) {
    throw new Error("Mobile wallet provider not found");
  }

  try {
    const response = await provider.connect();
    const publicKey = response.publicKey?.toString() || provider.publicKey?.toString();
    if (!publicKey) {
      throw new Error("No public key returned");
    }
    return { publicKey };
  } catch (err: any) {
    if (err.code === 4001) {
      throw new Error("Connection rejected by user");
    }
    throw new Error(err.message || "Failed to connect mobile wallet");
  }
}

/**
 * Sign transaction with mobile wallet
 */
export async function signTransactionMobile(
  transaction: Uint8Array
): Promise<Uint8Array> {
  if (!isMWAAvailable()) {
    throw new Error("Mobile wallet adapter not available");
  }

  const w = window as any;
  const provider = w.solana?.isMobile ? w.solana : w.solanaMobile || w.navigator?.solanaMobile;

  if (!provider) {
    throw new Error("Mobile wallet provider not found");
  }

  try {
    const signed = await provider.signTransaction(transaction);
    if (signed instanceof Uint8Array) {
      return signed;
    }
    if (signed.serialize) {
      return signed.serialize();
    }
    throw new Error("Invalid signed transaction format");
  } catch (err: any) {
    if (err.code === 4001) {
      throw new Error("Transaction signing rejected by user");
    }
    throw new Error(err.message || "Failed to sign transaction");
  }
}

/**
 * Sign message with mobile wallet
 */
export async function signMessageMobile(
  message: Uint8Array
): Promise<{ signature: Uint8Array }> {
  if (!isMWAAvailable()) {
    throw new Error("Mobile wallet adapter not available");
  }

  const w = window as any;
  const provider = w.solana?.isMobile ? w.solana : w.solanaMobile || w.navigator?.solanaMobile;

  if (!provider) {
    throw new Error("Mobile wallet provider not found");
  }

  try {
    const result = await provider.signMessage(message, "utf8");
    return {
      signature: result.signature instanceof Uint8Array
        ? result.signature
        : new Uint8Array(Object.values(result.signature)),
    };
  } catch (err: any) {
    if (err.code === 4001) {
      throw new Error("Message signing rejected by user");
    }
    throw new Error(err.message || "Failed to sign message");
  }
}

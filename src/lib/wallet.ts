/**
 * Safe Solana wallet connection helper
 * Fail-safe: never leaves promise rejection unhandled
 */
export async function connectWallet(): Promise<
  | { ok: true; address: string }
  | { ok: false; error: string }
> {
  // Check if in browser
  if (typeof window === "undefined") {
    return {
      ok: false,
      error: "Wallet not available (server-side)",
    };
  }

  const w = window as any;
  const provider = w?.solana;

  // Check if any Solana wallet is available
  if (!provider) {
    return {
      ok: false,
      error: "Wallet not available (demo mode)",
    };
  }

  try {
    const res = await provider.connect?.();
    const pubkey =
      res?.publicKey?.toString?.() ||
      provider.publicKey?.toString?.();

    if (!pubkey) {
      return {
        ok: false,
        error: "Connected but no publicKey returned",
      };
    }

    return { ok: true, address: pubkey };
  } catch (e: any) {
    // Capture all possible errors
    const errorMessage =
      e?.message ||
      e?.toString() ||
      "Failed to connect wallet";

    // Specific error for user rejection
    if (e?.code === 4001 || errorMessage.includes("rejected")) {
      return {
        ok: false,
        error: "Connection rejected by user",
      };
    }

    return {
      ok: false,
      error: errorMessage,
    };
  }
}

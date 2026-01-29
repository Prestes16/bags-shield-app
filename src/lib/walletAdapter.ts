/**
 * Unified wallet adapter interface
 * Supports:
 * - Solana Wallet Standard (Phantom, Solflare, Backpack, etc.)
 * - Solana Mobile Wallet Adapter (MWA) for Seeker/Saga/Seed Vault
 */

import {
  isMWAAvailable,
  getMobileWalletAdapter,
  connectMobileWallet,
  signTransactionMobile,
  signMessageMobile,
} from "./mobileWalletAdapter";

export interface WalletAdapter {
  name: string;
  icon?: string;
  url?: string;
  ready: boolean;
  publicKey: string | null;
  connecting: boolean;
  connected: boolean;
}

export interface WalletAdapterMethods {
  connect(): Promise<{ publicKey: string }>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Uint8Array): Promise<Uint8Array>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
  sendTransaction(transaction: Uint8Array): Promise<string>; // Returns signature
}

export interface UnifiedWalletAdapter
  extends WalletAdapter, WalletAdapterMethods {}

/**
 * Detect wallets using Solana Wallet Standard
 * Priority: Solana Mobile (Seed Vault) FIRST, then standard wallets
 */
export function detectWallets(): WalletAdapter[] {
  if (typeof window === "undefined") return [];

  const wallets: WalletAdapter[] = [];
  const w = window as any;

  // PRIORITY 1: Solana Mobile Wallet Adapter (MWA) - Seed Vault FIRST
  if (isMWAAvailable()) {
    const mwa = getMobileWalletAdapter();
    if (mwa) {
      wallets.push({
        name: mwa.name, // "Solana Mobile (Seed Vault)"
        icon: "https://solanamobile.com/favicon.ico",
        url: "https://solanamobile.com",
        ready: mwa.ready,
        publicKey: mwa.publicKey,
        connecting: false,
        connected: mwa.connected,
      });
    }
  }

  // PRIORITY 2: Standard wallets (Phantom, Solflare, Backpack)
  if (w.solana && w.solana.isPhantom) {
    wallets.push({
      name: "Phantom",
      icon: "https://phantom.app/img/logo.png",
      url: "https://phantom.app",
      ready: !!w.solana.isConnected,
      publicKey: w.solana.publicKey?.toString() || null,
      connecting: false,
      connected: !!w.solana.isConnected,
    });
  }

  if (w.solana && w.solana.isSolflare) {
    wallets.push({
      name: "Solflare",
      icon: "https://solflare.com/favicon.ico",
      url: "https://solflare.com",
      ready: !!w.solana.isConnected,
      publicKey: w.solana.publicKey?.toString() || null,
      connecting: false,
      connected: !!w.solana.isConnected,
    });
  }

  if (w.solana && w.solana.isBackpack) {
    wallets.push({
      name: "Backpack",
      icon: "https://backpack.app/favicon.ico",
      url: "https://backpack.app",
      ready: !!w.solana.isConnected,
      publicKey: w.solana.publicKey?.toString() || null,
      connecting: false,
      connected: !!w.solana.isConnected,
    });
  }

  // Generic Solana wallet (Wallet Standard)
  if (
    w.solana &&
    !wallets.some(
      (w) =>
        w.name.includes("Phantom") ||
        w.name.includes("Solflare") ||
        w.name.includes("Backpack"),
    )
  ) {
    wallets.push({
      name: "Solana Wallet",
      ready: !!w.solana.isConnected,
      publicKey: w.solana.publicKey?.toString() || null,
      connecting: false,
      connected: !!w.solana.isConnected,
    });
  }

  return wallets;
}

/**
 * Get suggested wallets (not detected, but recommended)
 * Includes Jupiter Mobile as a suggested option
 */
export function getSuggestedWallets(): WalletAdapter[] {
  const suggested: WalletAdapter[] = [];

  // Jupiter Mobile - suggested wallet (can't detect if installed, so always suggest)
  suggested.push({
    name: "Jupiter Mobile",
    icon: "https://jup.ag/favicon.ico",
    url: "https://jup.ag/mobile",
    ready: false,
    publicKey: null,
    connecting: false,
    connected: false,
  });

  return suggested;
}

/**
 * Create unified wallet adapter from detected wallet
 */
export function createUnifiedAdapter(
  wallet: WalletAdapter,
): UnifiedWalletAdapter | null {
  if (typeof window === "undefined") return null;

  const w = window as any;
  const provider = w.solana;

  if (!provider) return null;

  // Check if this is a mobile wallet
  const isMobile = isMWAAvailable() && wallet.name.includes("Mobile");

  const adapter: UnifiedWalletAdapter = {
    ...wallet,
    async connect() {
      // Feature flag check should be done in component/hook, not here
      // This allows wallet adapter to be used independently
      this.connecting = true;
      try {
        let publicKey: string;

        if (isMobile) {
          // Use mobile wallet adapter
          const result = await connectMobileWallet();
          publicKey = result.publicKey;
        } else {
          // Use standard wallet
          const response = await provider.connect();
          publicKey =
            response.publicKey?.toString() || provider.publicKey?.toString();
          if (!publicKey) {
            throw new Error("No public key returned");
          }
        }

        this.publicKey = publicKey;
        this.connected = true;
        this.ready = true;
        return { publicKey };
      } catch (err: any) {
        this.connecting = false;
        if (err.code === 4001) {
          throw new Error("Connection rejected by user");
        }
        throw new Error(err.message || "Failed to connect wallet");
      } finally {
        this.connecting = false;
      }
    },
    async disconnect() {
      try {
        await provider.disconnect();
        this.publicKey = null;
        this.connected = false;
        this.ready = false;
      } catch (err: any) {
        throw new Error(err.message || "Failed to disconnect wallet");
      }
    },
    async signTransaction(transaction: Uint8Array) {
      if (!this.connected || !this.publicKey) {
        throw new Error("Wallet not connected");
      }

      try {
        if (isMobile) {
          return await signTransactionMobile(transaction);
        }

        // Standard wallet signing
        const signed = await provider.signTransaction(
          typeof transaction === "string" ? transaction : transaction,
        );

        // Return signed transaction as Uint8Array
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
    },
    async signMessage(message: Uint8Array) {
      if (!this.connected || !this.publicKey) {
        throw new Error("Wallet not connected");
      }

      try {
        if (isMobile) {
          return await signMessageMobile(message);
        }

        // Standard wallet signing
        const result = await provider.signMessage(message, "utf8");
        return {
          signature:
            result.signature instanceof Uint8Array
              ? result.signature
              : new Uint8Array(Object.values(result.signature)),
        };
      } catch (err: any) {
        if (err.code === 4001) {
          throw new Error("Message signing rejected by user");
        }
        throw new Error(err.message || "Failed to sign message");
      }
    },
    async sendTransaction(transaction: Uint8Array) {
      if (!this.connected || !this.publicKey) {
        throw new Error("Wallet not connected");
      }

      try {
        const signature = await provider.sendTransaction(transaction);
        return typeof signature === "string" ? signature : signature.toString();
      } catch (err: any) {
        if (err.code === 4001) {
          throw new Error("Transaction sending rejected by user");
        }
        throw new Error(err.message || "Failed to send transaction");
      }
    },
  };

  return adapter;
}

/**
 * Get the best available wallet adapter
 */
export function getBestWalletAdapter(): UnifiedWalletAdapter | null {
  const wallets = detectWallets();
  if (wallets.length === 0) return null;

  // Prefer connected wallets
  const connected = wallets.find((w) => w.connected);
  if (connected) {
    return createUnifiedAdapter(connected);
  }

  // Otherwise, use first available
  return createUnifiedAdapter(wallets[0]);
}

/**
 * Check if any wallet is available
 */
export function hasWalletAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!w.solana;
}

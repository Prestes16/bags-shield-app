"use client";

import { useState, useEffect, useCallback } from "react";
import { getBestWalletAdapter, UnifiedWalletAdapter, detectWallets } from "@/lib/walletAdapter";
import { useFeatureFlags } from "./useFeatureFlags";

export interface UseWalletReturn {
  adapter: UnifiedWalletAdapter | null;
  connected: boolean;
  publicKey: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => void;
}

/**
 * Hook for wallet management
 */
export function useWallet(): UseWalletReturn {
  const [adapter, setAdapter] = useState<UnifiedWalletAdapter | null>(null);
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { flags } = useFeatureFlags();

  const walletEnabled = flags?.WALLET_CONNECT_ENABLED ?? true; // Default true

  // Initialize adapter
  useEffect(() => {
    if (typeof window === "undefined" || !walletEnabled) return;

    const bestAdapter = getBestWalletAdapter();
    if (bestAdapter) {
      setAdapter(bestAdapter);
      setConnected(bestAdapter.connected);
      setPublicKey(bestAdapter.publicKey);
    }

    // Listen for wallet events
    const handleAccountsChanged = () => {
      const updatedAdapter = getBestWalletAdapter();
      if (updatedAdapter) {
        setAdapter(updatedAdapter);
        setConnected(updatedAdapter.connected);
        setPublicKey(updatedAdapter.publicKey);
      }
    };

    const w = window as any;
    if (w.solana?.on) {
      w.solana.on("accountChanged", handleAccountsChanged);
      w.solana.on("disconnect", () => {
        setConnected(false);
        setPublicKey(null);
      });
    }

    return () => {
      if (w.solana?.removeListener) {
        w.solana.removeListener("accountChanged", handleAccountsChanged);
        w.solana.removeListener("disconnect", () => {});
      }
    };
  }, [walletEnabled]);

  const connect = useCallback(async () => {
    if (!walletEnabled) {
      setError("Wallet connection is disabled");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      let currentAdapter = adapter;
      if (!currentAdapter) {
        currentAdapter = getBestWalletAdapter();
        if (!currentAdapter) {
          throw new Error("No wallet detected. Please install a Solana wallet.");
        }
        setAdapter(currentAdapter);
      }

      const result = await currentAdapter.connect();
      setConnected(true);
      setPublicKey(result.publicKey);
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  }, [adapter, walletEnabled]);

  const disconnect = useCallback(async () => {
    if (!adapter) return;

    setConnecting(true);
    setError(null);

    try {
      await adapter.disconnect();
      setConnected(false);
      setPublicKey(null);
    } catch (err: any) {
      setError(err.message || "Failed to disconnect wallet");
    } finally {
      setConnecting(false);
    }
  }, [adapter]);

  const refresh = useCallback(() => {
    const bestAdapter = getBestWalletAdapter();
    if (bestAdapter) {
      setAdapter(bestAdapter);
      setConnected(bestAdapter.connected);
      setPublicKey(bestAdapter.publicKey);
    } else {
      setAdapter(null);
      setConnected(false);
      setPublicKey(null);
    }
  }, []);

  return {
    adapter,
    connected,
    publicKey,
    connecting,
    error,
    connect,
    disconnect,
    refresh,
  };
}

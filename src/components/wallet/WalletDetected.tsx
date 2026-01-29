"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { detectWallets, getBestWalletAdapter, UnifiedWalletAdapter, hasWalletAvailable, getSuggestedWallets } from "@/lib/walletAdapter";
import { cn } from "@/lib/utils";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export interface WalletDetectedProps {
  onConnect?: (publicKey: string) => void;
  onDisconnect?: () => void;
  className?: string;
}

/**
 * Wallet detection and connection component
 * Shows detected wallets and allows connection
 */
export function WalletDetected({
  onConnect,
  onDisconnect,
  className,
}: WalletDetectedProps) {
  const [wallets, setWallets] = useState(detectWallets());
  const [suggestedWallets, setSuggestedWallets] = useState(getSuggestedWallets());
  const [selectedAdapter, setSelectedAdapter] = useState<UnifiedWalletAdapter | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { flags } = useFeatureFlags();

  // Check feature flag
  const walletEnabled = flags?.WALLET_CONNECT_ENABLED ?? true; // Default true

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Refresh wallet list periodically
    const interval = setInterval(() => {
      setWallets(detectWallets());
    }, 2000);

    // Try to get best adapter
    const adapter = getBestWalletAdapter();
    if (adapter) {
      setSelectedAdapter(adapter);
    }

    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    if (!walletEnabled) {
      setError("Wallet connection is disabled");
      return;
    }

    let adapter = selectedAdapter;
    if (!adapter) {
      adapter = getBestWalletAdapter();
      if (!adapter) {
        setError("No wallet detected. Please install a Solana wallet.");
        return;
      }
      setSelectedAdapter(adapter);
    }

    setConnecting(true);
    setError(null);

    try {
      const result = await adapter.connect();
      if (onConnect) {
        onConnect(result.publicKey);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedAdapter) return;

    setConnecting(true);
    setError(null);

    try {
      await selectedAdapter.disconnect();
      setSelectedAdapter(null);
      if (onDisconnect) {
        onDisconnect();
      }
    } catch (err: any) {
      setError(err.message || "Failed to disconnect wallet");
    } finally {
      setConnecting(false);
    }
  };

  if (!hasWalletAvailable()) {
    return (
      <div className={cn("rounded-3xl border border-surface/40 bg-surface/30 p-4 backdrop-blur-xl", className)}>
        <div className="text-sm text-muted-foreground">
          No Solana wallet detected. Please install Phantom, Solflare, Backpack, or another Solana wallet.
        </div>
      </div>
    );
  }

  if (!walletEnabled) {
    return (
      <div className={cn("rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 backdrop-blur-xl", className)}>
        <div className="text-sm text-amber-300">
          Wallet connection is currently disabled.
        </div>
      </div>
    );
  }

  const connected = selectedAdapter?.connected || false;
  const publicKey = selectedAdapter?.publicKey || null;

  return (
    <div className={cn("rounded-3xl border border-surface/40 bg-surface/30 p-5 backdrop-blur-xl shadow-lg", className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-primary text-sm">🔗</span>
          </div>
          <div>
            <div className="text-sm font-semibold">Wallet Connection</div>
            <div className="text-xs text-muted-foreground">Connect your Solana wallet</div>
          </div>
        </div>

        {/* Detected wallets */}
        {wallets.length > 0 && (
          <div className="rounded-xl border border-surface/40 bg-surface/20 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Detected Wallets:</div>
            <div className="flex flex-wrap gap-2">
              {wallets.map((wallet) => (
                <div
                  key={wallet.name}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                    wallet.connected
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-sm"
                      : wallet.name.includes("Mobile") || wallet.name.includes("Seed Vault")
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-slate-500/40 bg-slate-500/15 text-slate-300"
                  )}
                >
                  {wallet.connected && (
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  <span>{wallet.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested wallets */}
        {suggestedWallets.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Suggested Wallets:</div>
            <div className="flex flex-wrap gap-2">
              {suggestedWallets.map((wallet) => (
                <a
                  key={wallet.name}
                  href={wallet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium transition-all hover:bg-primary/20"
                  )}
                >
                  <span>{wallet.name}</span>
                  <span className="text-xs">↗</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Connection status */}
        {connected && publicKey && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Connected:</div>
            <div className="text-sm font-mono truncate">{publicKey}</div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
            <div className="h-4 w-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-red-400 text-xs">!</span>
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-red-300">{error}</div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!connected ? (
            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleDisconnect}
              disabled={connecting}
            >
              {connecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

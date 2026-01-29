"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getBestWalletAdapter } from "@/lib/walletAdapter";
import { calculateMinOut, formatSlippageBps } from "@/lib/jupiter";
import { cn } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { TokenAvatar } from "@/components/token/TokenAvatar";
import { TokenMeta } from "@/lib/tokenMeta";
import { Check, X, ExternalLink } from "lucide-react";

export interface JupiterSwapProps {
  inputMint: string; // Token to buy/sell
  outputMint: string; // SOL or other token
  amount: string; // Amount in smallest unit
  mode: "buy" | "sell";
  tokenMeta?: TokenMeta; // Token metadata for display
  onSuccess?: (signature: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * Jupiter swap component with mobile-first bottom sheet layout
 * Shows Buy/Sell buttons after scan
 * No fake data - only shows price when quote is available
 */
export function JupiterSwap({
  inputMint,
  outputMint,
  amount,
  mode,
  tokenMeta,
  onSuccess,
  onError,
  className,
}: JupiterSwapProps) {
  const [slippageBps, setSlippageBps] = useState(50); // Default 0.5%
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { connected, publicKey, connect } = useWallet();
  const { flags } = useFeatureFlags();
  
  // Debounce refs
  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastQuoteParamsRef = useRef<string>("");

  // Ensure first client render matches SSR (avoid hydration mismatch)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check feature flag - only after mount to avoid hydration mismatch
  const jupiterEnabled = mounted ? (flags?.JUPITER_SWAP_ENABLED ?? false) : false;

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (quoteTimeoutRef.current) {
        clearTimeout(quoteTimeoutRef.current);
      }
    };
  }, []);
  // Gate render without breaking Rules of Hooks (no early return before hooks)
  const shouldRender = mounted && jupiterEnabled;
  // Debounced quote fetch
  const handleGetQuote = useCallback(async () => {
    // Clear existing timeout
    if (quoteTimeoutRef.current) {
      clearTimeout(quoteTimeoutRef.current);
      quoteTimeoutRef.current = null;
    }

    // Check if wallet is connected (required for quote)
    if (!connected || !publicKey) {
      setError("Please connect your wallet first to get a quote");
      return;
    }

    // Create params key to prevent duplicate requests
    const paramsKey = JSON.stringify({
      inputMint: mode === "buy" ? outputMint : inputMint,
      outputMint: mode === "buy" ? inputMint : outputMint,
      amount,
      slippageBps,
    });

    // Skip if same params as last request
    if (paramsKey === lastQuoteParamsRef.current && quote) {
      return;
    }

    // Debounce: wait 500ms before fetching
    quoteTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setQuote(null);
      lastQuoteParamsRef.current = paramsKey;

      try {
        const response = await fetch("/api/jupiter/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputMint: mode === "buy" ? outputMint : inputMint,
            outputMint: mode === "buy" ? inputMint : outputMint,
            amount,
            slippageBps,
          }),
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "Failed to get quote");
        }

        // Include meta from response (contains appFeeApplied, appFeeBps)
        setQuote({
          ...data.response,
          meta: data.meta,
        });
      } catch (err: any) {
        setError(err.message || "Failed to get quote");
        if (onError) onError(err.message);
      } finally {
        setLoading(false);
      }
    }, 500);
  }, [mode, inputMint, outputMint, amount, slippageBps, connected, publicKey, quote, onError]);

  const handleSwap = async () => {
    if (!quote) return;

    // Check wallet connection
    if (!connected || !publicKey) {
      setError("Please connect your wallet first");
      try {
        await connect();
      } catch (err: any) {
        setError(err.message || "Failed to connect wallet");
      }
      return;
    }

    setLoading(true);
    setError(null);
    setTxStatus("pending");

    try {
      // Get wallet adapter
      const adapter = getBestWalletAdapter();
      if (!adapter || !adapter.connected || !adapter.publicKey) {
        throw new Error("Wallet not connected");
      }

      // Get swap transaction
      const swapResponse = await fetch("/api/jupiter/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: adapter.publicKey,
        }),
      });

      const swapData = await swapResponse.json();
      if (!swapData.success) {
        throw new Error(swapData.error || "Failed to get swap transaction");
      }

      // Decode base64 transaction
      const txBytes = Uint8Array.from(
        atob(swapData.response.swapTransaction),
        (c) => c.charCodeAt(0)
      );

      // Sign transaction
      const signedTx = await adapter.signTransaction(txBytes);

      // Send transaction
      const signature = await adapter.sendTransaction(signedTx);

      setTxSignature(signature);
      setTxStatus("success");
      if (onSuccess) onSuccess(signature);
    } catch (err: any) {
      setError(err.message || "Swap failed");
      setTxStatus("failed");
      if (onError) onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const minOut = quote ? calculateMinOut(quote.outAmount, slippageBps) : null;
  const priceImpact = quote ? parseFloat(quote.priceImpactPct || "0") : null;

  // Token display info
  const tokenName = tokenMeta?.name || tokenMeta?.symbol || inputMint.slice(0, 4);
  const tokenSymbol = tokenMeta?.symbol || inputMint.slice(0, 2);
  if (!shouldRender) {
    return null;
  }

  // Mobile-first bottom sheet modal
  return (
    <>
      {/* Trigger button */}
      <Button
        className={cn("w-full", className)}
        onClick={() => setIsOpen(true)}
        disabled={loading}
      >
        {mode === "buy" ? "Buy Token" : "Sell Token"}
      </Button>

      {/* Bottom sheet modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className={cn(
              "w-full max-h-[90vh] rounded-t-3xl border-t border-surface/40 bg-surface/95 backdrop-blur-xl",
              "overflow-y-auto shadow-2xl",
              "animate-in slide-in-from-bottom duration-300"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - sticky */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface/40 bg-surface/95 backdrop-blur-xl p-4">
              <div className="flex items-center gap-3">
                <TokenAvatar
                  imageUrl={tokenMeta?.imageUrl}
                  symbol={tokenSymbol}
                  size={40}
                />
                <div>
                  <div className="text-base font-semibold">
                    {mode === "buy" ? "Buy" : "Sell"} {tokenName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Via Jupiter Aggregator
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 hover:bg-surface/50 transition-colors"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            {/* Body - scrollable */}
            <div className="p-4 space-y-4">
              {/* Slippage settings */}
              <div className="rounded-xl border border-surface/40 bg-surface/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Slippage Tolerance
                  </div>
                  <div className="text-xs font-semibold text-primary">
                    {formatSlippageBps(slippageBps)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {[10, 50, 100, 500].map((bps) => (
                    <button
                      key={bps}
                      onClick={() => setSlippageBps(bps)}
                      className={cn(
                        "flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                        slippageBps === bps
                          ? "border-primary bg-primary/20 text-primary shadow-sm"
                          : "border-surface/40 bg-surface/10 text-muted-foreground hover:bg-surface/20"
                      )}
                    >
                      {formatSlippageBps(bps)}
                    </button>
                  ))}
                </div>
              </div>

              {/* App Fee Info */}
              {quote && quote.meta?.appFeeApplied && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      App Fee
                      <span className="ml-1 text-xs" title="Used to keep the service alive (infra + security). Network fees are separate.">
                        ℹ
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {quote.meta?.appFeeBps ? `${(quote.meta.appFeeBps / 100).toFixed(2)}%` : "0.40%"}
                    </span>
                  </div>
                </div>
              )}

              {/* Quote info - ONLY show when quote exists (no fake data) */}
              {quote ? (
                <div className="space-y-3 rounded-xl border border-surface/40 bg-surface/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Expected Output</span>
                    <span className="text-sm font-mono font-semibold">{quote.outAmount}</span>
                  </div>
                  {minOut && (
                    <div className="flex items-center justify-between pt-2 border-t border-surface/30">
                      <span className="text-xs font-medium text-muted-foreground">Minimum Output</span>
                      <span className="text-sm font-mono font-semibold text-amber-300">{minOut}</span>
                    </div>
                  )}
                  {priceImpact !== null && (
                    <div className="flex items-center justify-between pt-2 border-t border-surface/30">
                      <span className="text-xs font-medium text-muted-foreground">Price Impact</span>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          priceImpact > 1 ? "text-red-300" : priceImpact > 0.5 ? "text-amber-300" : "text-emerald-300"
                        )}
                      >
                        {priceImpact.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                // No quote yet - show message
                <div className="rounded-xl border border-surface/40 bg-surface/20 p-4 text-center">
                  <div className="text-sm text-muted-foreground">
                    {!connected || !publicKey
                      ? "Connect wallet to get quote"
                      : "Click 'Get Quote' to see price and details"}
                  </div>
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

              {/* Transaction status */}
              {txStatus !== "idle" && (
                <div
                  className={cn(
                    "rounded-xl border p-4 flex items-start gap-3",
                    txStatus === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : txStatus === "failed"
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-amber-500/30 bg-amber-500/10"
                  )}
                >
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                    txStatus === "success"
                      ? "bg-emerald-500/20"
                      : txStatus === "failed"
                      ? "bg-red-500/20"
                      : "bg-amber-500/20 animate-pulse"
                  )}>
                    {txStatus === "success" && <Check className="h-4 w-4 text-emerald-300" />}
                    {txStatus === "failed" && <X className="h-4 w-4 text-red-300" />}
                    {txStatus === "pending" && <span className="text-amber-300 text-xs">...</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold mb-1">
                      {txStatus === "pending" && "Transaction Pending..."}
                      {txStatus === "success" && "Transaction Successful!"}
                      {txStatus === "failed" && "Transaction Failed"}
                    </div>
                    {txSignature && (
                      <a
                        href={`https://solscan.io/tx/${txSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline break-all inline-flex items-center gap-1"
                      >
                        <span>View on Solscan:</span>
                        <span className="font-mono">{txSignature.slice(0, 8)}...</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer - sticky with CTA */}
            <div className="sticky bottom-0 border-t border-surface/40 bg-surface/95 backdrop-blur-xl p-4">
              <div className="flex gap-2">
                {!quote ? (
                  <Button
                    className="w-full"
                    onClick={handleGetQuote}
                    disabled={loading || !connected || !publicKey}
                  >
                    {loading ? "Getting Quote..." : "Get Quote"}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        setQuote(null);
                        setError(null);
                        setTxStatus("idle");
                        setTxSignature(null);
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSwap}
                      disabled={loading || txStatus === "pending"}
                    >
                      {loading || txStatus === "pending"
                        ? "Processing..."
                        : mode === "buy"
                        ? "Buy"
                        : "Sell"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

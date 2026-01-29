"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

function isBase58Mint(v: string) {
  const s = (v || "").trim();
  if (s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

export function ScanInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mint, setMint] = useState("");
  const [proScan, setProScan] = useState(false);
  const [paying, setPaying] = useState(false);
  const { connected, publicKey, connect } = useWallet();
  const { flags } = useFeatureFlags();

  // Pre-fill mint from query param
  useEffect(() => {
    const mintParam = searchParams.get("mint");
    if (mintParam && isBase58Mint(mintParam)) {
      setMint(mintParam);
    }
  }, [searchParams]);

  const ok = useMemo(() => isBase58Mint(mint), [mint]);
  // Access fees from API response (nested structure)
  const feesConfig = (flags as any)?.fees;
  const proScanEnabled = feesConfig?.proScanEnabled ?? false;
  const proScanLamports = feesConfig?.proScanLamports ?? 100000;
  const walletEnabled = flags?.WALLET_CONNECT_ENABLED ?? true;

  // Format lamports to SOL
  const proScanSOL = (proScanLamports / 1_000_000_000).toFixed(6);

  const handleProScanPayment = async () => {
    if (!connected || !publicKey) {
      try {
        await connect();
        // Wait a bit for connection to establish
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Retry if now connected
        if (publicKey) {
          handleProScanPayment();
        } else {
          alert("Please connect your wallet to use Pro Scan");
        }
      } catch (err: any) {
        console.error("Failed to connect wallet:", err);
        alert("Please connect your wallet to use Pro Scan");
      }
      return;
    }

    setPaying(true);
    try {
      // Get fees config to show payment details
      const featuresResponse = await fetch("/api/features");
      const featuresData = await featuresResponse.json();
      const destination = featuresData.response?.fees?.wallets?.ops;

      if (!destination) {
        throw new Error("Pro Scan not configured");
      }

      // For MVP: Show instructions and let user pay manually
      // In production, integrate with wallet.sendTransaction using @solana/web3.js
      const paymentInstructions = `To use Pro Scan, please send ${proScanSOL} SOL to:\n\n${destination}\n\nAfter payment, you can provide the transaction signature.`;
      
      const userConfirmed = confirm(paymentInstructions + "\n\nClick OK to continue to scan (you can add signature later) or Cancel to stay here.");
      
      if (userConfirmed) {
        // Redirect to scan - user can add signature manually in a future step
        router.push(`/scan/loading?mint=${encodeURIComponent(mint.trim())}&pro=true`);
      } else {
        setPaying(false);
      }
    } catch (err: any) {
      console.error("Pro Scan payment error:", err);
      alert(`Payment setup failed: ${err.message || "Unknown error"}`);
      setPaying(false);
    }
  };

  const handleScan = () => {
    if (proScan && proScanEnabled) {
      if (!connected) {
        handleProScanPayment();
        return;
      }
      handleProScanPayment();
    } else {
      router.push(`/scan/loading?mint=${encodeURIComponent(mint.trim())}`);
    }
  };

  return (
    <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 backdrop-blur-xl shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="text-primary text-lg">🔍</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Scan Token</h2>
          <p className="text-xs text-muted-foreground">
            Analyze token security and risk
          </p>
        </div>
      </div>

      <div className="mt-5">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          Mint Address
        </label>
        <input
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="So11111111111111111111111111111111111111112"
          className={cn(
            "w-full rounded-xl border bg-transparent px-4 py-3 text-sm outline-none transition-all",
            ok 
              ? "border-surface/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20" 
              : "border-red-500/40 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
          )}
        />
        {!ok && mint.trim().length > 0 ? (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-red-400">⚠</span>
            <p className="text-xs text-red-400">Invalid mint (Base58 32–44 chars)</p>
          </div>
        ) : ok && mint.trim().length > 0 ? (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-emerald-400">✓</span>
            <p className="text-xs text-emerald-400">Valid mint address</p>
          </div>
        ) : null}
      </div>

      {/* Pro Scan Toggle */}
      {proScanEnabled && (
        <div className="mt-4 rounded-xl border border-surface/40 bg-surface/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pro-scan"
                checked={proScan}
                onChange={(e) => setProScan(e.target.checked)}
                className="h-4 w-4 rounded border-surface/40"
              />
              <label htmlFor="pro-scan" className="text-xs font-medium cursor-pointer">
                Pro Scan
              </label>
            </div>
            <div className="text-xs text-muted-foreground">
              {proScanSOL} SOL
            </div>
          </div>
          {proScan && !connected && walletEnabled && (
            <div className="mt-2 text-xs text-amber-300">
              💡 Connect wallet to pay and run Pro Scan
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        <Button
          className="w-full"
          disabled={!ok || paying}
          onClick={handleScan}
        >
          {paying
            ? "Processing Payment..."
            : proScan && proScanEnabled
            ? connected
              ? `💎 Pay & Run Pro Scan (${proScanSOL} SOL)`
              : "Connect Wallet for Pro Scan"
            : ok
            ? "🔍 Scan Now"
            : "Enter Valid Mint Address"}
        </Button>
      </div>
    </div>
  );
}

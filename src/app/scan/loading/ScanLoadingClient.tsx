"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { ScanLoadingRadar } from "@/components/scan/ScanLoadingRadar";
import { setScanRecord, getScanRecord } from "@/lib/scanStore";

const isSolanaBase58 = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

export default function ScanLoadingClient({ mint }: { mint: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const m = (mint || "").trim();

    if (!isSolanaBase58(m)) {
      router.replace("/scan");
      return;
    }

    // Perform scan API call
    const performScan = async () => {
      try {
        // Call scan API - proxy will forward to backend
        const response = await fetch("/api/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mint: m,
          }),
        });

        const data = await response.json();

        if (data.success && data.response) {
          const res = data.response;
          const score = res.shieldScore || res.score || 0;
          const grade = res.grade || "E";
          
          // Determine risk level
          let risk: "low" | "medium" | "high" = "low";
          if (score < 40) risk = "high";
          else if (score < 70) risk = "medium";

          // Save scan record (only if not frozen from scam history)
          const existingRecord = getScanRecord(m);
          if (!existingRecord?.frozen) {
            setScanRecord({
              mint: m,
              score,
              grade,
              risk,
              scannedAt: Date.now(),
              source: "scan",
              frozen: false,
            });
          }

          // Navigate to result
          router.replace(`/scan/result/${m}`);
        } else {
          setError(data.error || "Scan failed");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to scan");
      }
    };

    performScan();
  }, [mint, router]);

  const m = (mint || "").trim();
  if (!isSolanaBase58(m)) {
    return (
      <AppShell title="Scanning" subtitle="Processing signals…">
        <div className="rounded-3xl border border-red-500/30 bg-surface/30 p-6 backdrop-blur-xl">
          <h2 className="text-lg font-semibold">Invalid mint</h2>
          <p className="mt-1 text-sm text-muted-foreground">Please enter a valid Base58 mint address.</p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Scanning" subtitle="Processing signals…">
        <div className="rounded-3xl border border-red-500/30 bg-surface/30 p-6 backdrop-blur-xl">
          <h2 className="text-lg font-semibold">Scan error</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Scanning" subtitle="Processing signals…">
      <ScanLoadingRadar mint={m} />
    </AppShell>
  );
}

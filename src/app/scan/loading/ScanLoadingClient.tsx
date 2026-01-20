"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { ScanLoadingRadar } from "@/components/scan/ScanLoadingRadar";

const isSolanaBase58 = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

export default function ScanLoadingClient({ mint }: { mint: string }) {
  const router = useRouter();

  useEffect(() => {
    const m = (mint || "").trim();

    if (!isSolanaBase58(m)) {
      router.replace("/scan");
      return;
    }
  }, [mint, router]);

  const m = (mint || "").trim();
  if (!isSolanaBase58(m)) {
    return (
      <AppShell title="Scanning" subtitle="Processando sinais…">
        <div className="rounded-3xl border border-red-500/30 bg-surface/30 p-6 backdrop-blur-xl">
          <h2 className="text-lg font-semibold">Mint inválido</h2>
          <p className="mt-1 text-sm text-muted-foreground">Volte e cole um mint Base58 válido.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Scanning" subtitle="Processando sinais…">
      <ScanLoadingRadar mint={m} />
    </AppShell>
  );
}

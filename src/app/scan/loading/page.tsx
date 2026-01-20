import { Suspense } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { ScanLoadingRadar } from "@/components/scan/ScanLoadingRadar";

function Fallback() {
  return (
    <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 backdrop-blur-xl">
      <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-9 w-full animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-4 w-28 animate-pulse rounded bg-white/10" />
    </div>
  );
}

export default function Page() {
  return (
    <AppShell title="Scanning" subtitle="Processando sinais…">
      <Suspense fallback={<Fallback />}>
        <ScanLoadingRadar />
      </Suspense>
    </AppShell>
  );
}
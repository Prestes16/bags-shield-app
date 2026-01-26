import { Suspense } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { ScanInput } from "@/components/scan/ScanInput";

export function ScanScreen() {
  return (
    <AppShell title="Search" subtitle="Enter mint address and run scan">
      <Suspense fallback={<div className="rounded-3xl border border-surface/40 bg-surface/30 p-5 backdrop-blur-xl">Loading...</div>}>
        <ScanInput />
      </Suspense>
    </AppShell>
  );
}

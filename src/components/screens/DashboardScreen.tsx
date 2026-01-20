import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";

export function DashboardScreen() {
  return (
    <AppShell title="Dashboard" subtitle="Visão rápida e atalhos">
      <div className="grid gap-3">
        <div className="rounded-3xl border border-surface/40 bg-surface/30 p-5 backdrop-blur-xl">
          <div className="text-sm text-muted-foreground">Status</div>
          <div className="mt-1 text-2xl font-semibold">
            Wallet: <span className="text-primary">Connected</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button asChild className="w-full"><Link href="/scan">New Scan</Link></Button>
            <Button asChild variant="secondary" className="w-full"><Link href="/watchlist">Watchlist</Link></Button>
          </div>
        </div>

        <div className="rounded-3xl border border-surface/40 bg-surface/30 p-5 backdrop-blur-xl">
          <div className="text-sm font-semibold">Quick tips</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Neon = vibe Bags app.</li>
            <li>Mobile: safe-area + bottom nav ok.</li>
            <li>Scan → Result → Findings detalhados.</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

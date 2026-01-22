"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { WatchlistSkeleton } from "@/components/states/WatchlistSkeleton";
import { EmptyWatchlist } from "@/components/states/EmptyWatchlist";
import { cn } from "@/lib/utils";
import { getScanRecord } from "@/lib/scanStore";
import { shouldShowScore, scoreLabel } from "@/lib/scorePolicy";
import { Button } from "@/components/ui/button";

type WatchedToken = {
  symbol: string;
  name: string;
  mint: string;
  score: number;
  trend: "up" | "down";
  alert: boolean;
};

const mock: WatchedToken[] = [
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112", score: 92, trend: "up", alert: false },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", score: 74, trend: "up", alert: true },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", score: 61, trend: "down", alert: true },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8wZ8GZkVf7cB8tR6xGgq8o5o2d7rYcZb7c3a", score: 83, trend: "up", alert: false },
];

function glow(score: number) {
  if (score >= 80) return "shadow-[0_0_24px_rgba(79,209,255,0.18)]";
  if (score >= 65) return "shadow-[0_0_24px_rgba(255,215,0,0.12)]";
  return "shadow-[0_0_24px_rgba(255,80,80,0.12)]";
}

export function WatchlistScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<WatchedToken[]>([]);

  useEffect(() => {
    const t = setTimeout(() => { setList(mock); setLoading(false); }, 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <AppShell title="Watchlist" subtitle="Alertas e ShieldScore dos tokens que você acompanha">
      {loading ? <WatchlistSkeleton /> : null}
      {!loading && list.length === 0 ? <EmptyWatchlist /> : null}

      {!loading && list.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((t) => {
            const scanRecord = getScanRecord(t.mint);
            const hasScanResult = !!scanRecord;
            const isKnownScamHistory = scanRecord?.source === "scam_history";
            const canShowScore = shouldShowScore({ hasScanResult, isKnownScamHistory });
            const label = scoreLabel({ hasScanResult, isKnownScamHistory });

            return (
              <div
                key={t.mint}
                className={cn(
                  "min-w-0 rounded-3xl border border-surface/40 bg-surface/30 p-4 backdrop-blur-xl",
                  canShowScore ? glow(scanRecord?.score || t.score) : ""
                )}
              >
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground truncate">{t.name}</div>
                    <div className="text-lg font-semibold">{t.symbol}</div>
                  </div>
                  <div className={cn(
                    "rounded-2xl border border-surface/40 bg-surface/30 px-3 py-2 shrink-0",
                    t.alert ? "text-amber-300" : "text-muted-foreground"
                  )}>
                    {t.alert ? "🔔" : "—"}
                  </div>
                </div>

                {canShowScore ? (
                  <>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">ShieldScore</div>
                      <div className="text-xl font-semibold text-primary">{scanRecord?.score || t.score}</div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground truncate">{t.mint}</div>
                    <div className="mt-3 text-sm">
                      {t.trend === "up" ? <span className="text-emerald-400">▲ Uptrend</span> : <span className="text-rose-400">▼ Downtrend</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <span className="inline-flex items-center rounded-full border border-surface/40 bg-surface/20 px-2 py-1 text-xs text-muted-foreground">
                        Not scanned
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground truncate">{t.mint}</div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/scan?mint=${encodeURIComponent(t.mint)}`);
                        }}
                      >
                        Scan now
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </AppShell>
  );
}

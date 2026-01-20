import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { cn } from "@/lib/utils";

const items = [
  { mint: "So11111111111111111111111111111111111111112", when: "Hoje", score: 92, grade: "A" },
  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", when: "Ontem", score: 61, grade: "C" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", when: "3 dias", score: 74, grade: "B" },
];

export function HistoryScreen() {
  return (
    <AppShell title="History" subtitle="Últimos scans executados">
      <div className="space-y-3">
        {items.map((x) => (
          <Link
            key={x.mint}
            href={`/scan/result/${x.mint}`}
            className={cn("block rounded-3xl border border-surface/40 bg-surface/30 p-4 backdrop-blur-xl hover:bg-surface/40 transition")}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Grade {x.grade}</div>
              <div className="text-sm text-primary font-semibold">{x.score}</div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground truncate">{x.mint}</div>
            <div className="mt-2 text-xs text-muted-foreground">{x.when}</div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { cn } from "@/lib/utils";
import { getScanRecord } from "@/lib/scanStore";
import { shouldShowScore, scoreLabel } from "@/lib/scorePolicy";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const items = [
  { mint: "So11111111111111111111111111111111111111112", when: "Today", score: 92, grade: "A" },
  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", when: "Yesterday", score: 61, grade: "C" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", when: "3 days ago", score: 74, grade: "B" },
];

export function HistoryScreen() {
  const router = useRouter();

  const historyItems = useMemo(() => {
    return items.map((item) => {
      const scanRecord = getScanRecord(item.mint);
      const hasScanResult = !!scanRecord;
      const isKnownScamHistory = scanRecord?.source === "scam_history";
      const canShowScore = shouldShowScore({ hasScanResult, isKnownScamHistory });
      const label = scoreLabel({ hasScanResult, isKnownScamHistory });

      return {
        ...item,
        scanRecord,
        canShowScore,
        label,
        isKnownScamHistory,
        displayScore: scanRecord?.score || item.score,
        displayGrade: scanRecord?.grade || item.grade,
      };
    });
  }, []);

  return (
    <AppShell title="History" subtitle="Recent scans">
      <div className="space-y-3">
        {historyItems.map((x) => (
          <div
            key={x.mint}
            className={cn("block rounded-3xl border border-surface/40 bg-surface/30 p-4 backdrop-blur-xl hover:bg-surface/40 transition")}
          >
            {x.canShowScore ? (
              <button
                onClick={() => router.push(`/scan/result/${x.mint}`)}
                className="w-full text-left"
              >
                {x.isKnownScamHistory && (
                  <div className="mb-2">
                    <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-xs text-amber-300">
                      {t("ui.scam_history")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{t("ui.grade")} {x.displayGrade}</div>
                  <div className="text-sm text-primary font-semibold">{x.displayScore}</div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground truncate">{x.mint}</div>
                <div className="mt-2 text-xs text-muted-foreground">{x.when}</div>
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{x.label}</div>
                  <span className="inline-flex items-center rounded-full border border-surface/40 bg-surface/20 px-2 py-1 text-xs text-muted-foreground">
                    {t("ui.not_scanned")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground truncate">{x.mint}</div>
                <div className="mt-2 text-xs text-muted-foreground">{x.when}</div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => router.push(`/scan?mint=${encodeURIComponent(x.mint)}`)}
                  >
                    {t("ui.scan_now")}
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

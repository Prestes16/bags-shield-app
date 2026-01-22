"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";
import FindingDetails from "@/components/bags-shield/finding-details";
import { shareSafe } from "@/components/shared/shareSafe";
import { cn } from "@/lib/utils";
import { getScanRecord } from "@/lib/scanStore";
import { shouldShowScore } from "@/lib/scorePolicy";
import { t } from "@/lib/i18n";

type Severity = "ok" | "attention" | "high";
type Finding = { id: string; title: string; severity: Severity; details?: string | string[]; hint?: string; };

function grade(score: number) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

function pill(sev: Severity) {
  if (sev === "ok") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (sev === "high") return "bg-rose-500/20 text-rose-200 border-rose-500/30";
  return "bg-amber-500/20 text-amber-200 border-amber-500/30";
}

export default function Page() {
  const router = useRouter();
  const params = useParams<{ mint: string }>();
  const mint = (params?.mint || "").toString();

  // Get scan record from store
  const scanRecord = getScanRecord(mint);
  const hasScanResult = !!scanRecord;
  const isKnownScamHistory = scanRecord?.source === "scam_history";
  const canShowScore = shouldShowScore({ hasScanResult, isKnownScamHistory });

  // Use scan record if available, otherwise fallback to mock
  const score = scanRecord?.score || (() => {
    const n = (mint.length * 7) % 100;
    return Math.max(35, Math.min(95, n));
  })();

  const findings = useMemo<Finding[]>(() => ([
    { id: "liq", title: "Liquidity Locked", severity: score >= 80 ? "ok" : "attention", details: "Heurística (UI). Depois pluga o dado real." },
    { id: "freeze", title: "Freeze Authority", severity: score >= 70 ? "attention" : "high", details: ["Freeze authority presente", "Checar risco antes de aportar alto"], hint: "Se High, evitar trade grande." },
    { id: "mint", title: "Mint Authority", severity: score >= 85 ? "ok" : "attention", details: ["Mint authority sinal misto", "Validar revogação on-chain"] },
    { id: "holders", title: "Top Holders", severity: score >= 75 ? "attention" : "high", details: ["Concentração suspeita", "Pode dump/DoS de liquidez"], hint: "Se High, reduza exposição." },
  ]), [score]);

  const summary = useMemo(() => ([
    { id: "liq", title: "Liquidity Locked", sev: findings[0]?.severity ?? "attention" },
    { id: "freeze", title: "Freeze Authority", sev: findings[1]?.severity ?? "attention" },
    { id: "mint", title: "Mint Authority", sev: findings[2]?.severity ?? "attention" },
    { id: "holders", title: "Top Holders", sev: findings[3]?.severity ?? "attention" },
  ]), [findings]);

  const pct = Math.max(0, Math.min(100, score));
  const ringStyle: React.CSSProperties = {
    background: `conic-gradient(hsl(var(--primary)) ${pct}%, rgba(255,255,255,0.10) 0)`,
    WebkitMask: "radial-gradient(circle, transparent 58%, #000 59%)",
    mask: "radial-gradient(circle, transparent 58%, #000 59%)",
  };

  if (!canShowScore) {
    return (
      <AppShell title="Scan Result" subtitle={t("ui.token_not_scanned")}>
        <div className="rounded-3xl border border-surface/40 bg-surface/30 p-5 backdrop-blur-xl min-w-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Token</div>
              <div className="mt-1 flex items-center gap-2 min-w-0">
                <div className="grid h-9 w-9 place-items-center rounded-2xl border border-surface/40 bg-surface/30 shrink-0">🪙</div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold leading-tight">Token</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{mint}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 text-center">
            <span className="inline-flex items-center rounded-full border border-surface/40 bg-surface/20 px-3 py-1 text-sm text-muted-foreground">
              {t("ui.not_scanned")}
            </span>
          </div>
          <div className="mt-5">
            <Button
              className="w-full"
              onClick={() => router.push(`/scan?mint=${encodeURIComponent(mint)}`)}
            >
              {t("ui.scan_now")}
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Scan Result" subtitle={t("ui.scan_result_subtitle")}>
      <div className="rounded-3xl border border-surface/40 bg-surface/30 p-5 backdrop-blur-xl min-w-0">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Token</div>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <div className="grid h-9 w-9 place-items-center rounded-2xl border border-surface/40 bg-surface/30 shrink-0">🪙</div>
              <div className="min-w-0">
                <div className="text-lg font-semibold leading-tight">Token</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{mint}</div>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">{t("ui.grade")}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{grade(score)}</div>
            {isKnownScamHistory && (
              <div className="mt-1">
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                  {t("ui.scam_history")}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid place-items-center">
          <div className="relative h-44 w-44">
            <div className="absolute inset-0 rounded-full" style={ringStyle} />
            <div className="absolute inset-3 rounded-full border border-border/40 bg-card/20 backdrop-blur-xl" />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div className="text-sm text-muted-foreground">{t("ui.shield_score")}</div>
              <div className="text-5xl font-semibold">{score}</div>
              <div className="text-sm text-muted-foreground">({grade(score)})</div>
            </div>
          </div>
        </div>
      </div>

      {/* RESUMO: 1 coluna no mobile, 2 no sm+ (isso mata o "corte") */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {summary.map((c) => (
          <div key={c.id} className="min-w-0 rounded-3xl border border-surface/40 bg-surface/30 p-4 backdrop-blur-xl">
            <div className="text-sm font-semibold">{c.title}</div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs", pill(c.sev as Severity))}>
                {c.sev}
              </span>
              <span className="text-xs text-muted-foreground">Details</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <FindingDetails items={findings} />
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="w-full" onClick={() => router.push("/simulate")}>
          {t("ui.simulate")}
        </Button>
        <Button className="w-full" onClick={async () => {
          try {
            const r = await shareSafe({ title: "Bags Shield", text: "Scan result", url: window.location.href });
            if (!r.ok) alert("Failed to share or copy.");
          } catch (err) {
            // Fail silently
          }
        }}>
          {t("ui.share")}
        </Button>
      </div>

      <div className="mt-3">
        <Button variant="secondary" className="w-full" onClick={() => router.push("/scan")}>
          {t("ui.scan_again")}
        </Button>
      </div>
    </AppShell>
  );
}

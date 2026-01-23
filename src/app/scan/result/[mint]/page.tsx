"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";
import FindingDetails from "@/components/bags-shield/finding-details";
import { shareSafe } from "@/components/shared/shareSafe";
import { cn } from "@/lib/utils";
import { getScanRecord, setScanRecord } from "@/lib/scanStore";
import { shouldShowScore } from "@/lib/scorePolicy";
import { t } from "@/lib/i18n";
import { TokenAvatar } from "@/components/token/TokenAvatar";
import { normalizeScanResponse } from "@/lib/scanNormalize";
import { ScanReportNormalized, RiskLabel } from "@/lib/scanTypes";

function riskLabelPill(riskLabel: RiskLabel) {
  if (riskLabel === "Low") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (riskLabel === "Medium") return "bg-amber-500/20 text-amber-200 border-amber-500/30";
  if (riskLabel === "High") return "bg-orange-500/20 text-orange-200 border-orange-500/30";
  if (riskLabel === "Critical") return "bg-rose-500/20 text-rose-200 border-rose-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toString();
  return String(value);
}

export default function Page() {
  const router = useRouter();
  const params = useParams<{ mint: string }>();
  const mint = (params?.mint || "").toString();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get scan record from store
  const scanRecord = getScanRecord(mint);
  const hasScanResult = !!scanRecord;
  const isKnownScamHistory = scanRecord?.source === "scam_history";
  const canShowScore = shouldShowScore({ hasScanResult, isKnownScamHistory });

  // Use report if available, otherwise use legacy fields
  const report: ScanReportNormalized | null = scanRecord?.report || null;
  const score = report?.shieldScore ?? scanRecord?.score ?? null;
  const grade = report?.grade ?? (scanRecord?.grade as any) ?? null;
  const riskLabel = report?.riskLabel ?? "Unknown";

  // Fetch report if missing or incomplete
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (scanRecord?.frozen) return; // Don't refresh frozen records
    if (report && report.shieldScore !== null) return; // Report is complete

    const fetchReport = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mint }),
        });

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await response.text();
          if (text.trim().startsWith("<!") || text.includes("<html")) {
            setError(t("error.backend_html"));
            setLoading(false);
            return;
          }
        }

        let data: any;
        try {
          data = await response.json();
        } catch (parseErr) {
          setError(t("error.invalid_response"));
          setLoading(false);
          return;
        }

        if (data.success && data.response) {
          const normalized = normalizeScanResponse(data.response, mint);
          
          // Update scan record with report
          const existing = getScanRecord(mint);
          if (existing && !existing.frozen) {
            setScanRecord({
              ...existing,
              report: normalized,
              fetchedAt: Date.now(),
              score: normalized.shieldScore ?? existing.score ?? 0,
              grade: normalized.grade || existing.grade || "E",
            });
          }
        } else {
          setError(data.error || t("error.scan_failed"));
        }
      } catch (err: any) {
        setError(err?.message || t("error.scan_failed"));
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [mint, report, scanRecord?.frozen]);

  // Convert normalized findings to UI format
  const findings = useMemo(() => {
    if (report?.findings && report.findings.length > 0) {
      return report.findings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: (f.severity === "critical" ? "high" : f.severity || "attention") as "ok" | "attention" | "high",
        details: f.description || f.details || undefined,
      }));
    }
    // Fallback: empty findings
    return [];
  }, [report]);

  // Summary cards from report data
  const summary = useMemo(() => {
    const items = [];
    
    if (report?.liquidity) {
      items.push({
        id: "liquidity",
        title: "Liquidity",
        value: report.liquidity.locked !== null ? (report.liquidity.locked ? "Locked" : "Unlocked") : "—",
      });
    }
    
    if (report?.authorities) {
      const hasFreeze = report.authorities.freezeAuthority !== null;
      items.push({
        id: "authorities",
        title: "Authorities",
        value: hasFreeze ? "Present" : "—",
      });
    }
    
    if (report?.holders) {
      items.push({
        id: "holders",
        title: "Holders",
        value: report.holders.top10Concentration !== null 
          ? `${formatValue(report.holders.top10Concentration)}%` 
          : "—",
      });
    }
    
    if (report?.taxes) {
      items.push({
        id: "taxes",
        title: "Taxes",
        value: report.taxes.buyTax !== null || report.taxes.sellTax !== null
          ? `Buy: ${formatValue(report.taxes.buyTax)}% / Sell: ${formatValue(report.taxes.sellTax)}%`
          : "—",
      });
    }

    return items;
  }, [report]);

  const pct = score !== null ? Math.max(0, Math.min(100, score)) : 0;
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
                <TokenAvatar
                  imageUrl={scanRecord?.tokenMeta?.imageUrl}
                  symbol={scanRecord?.tokenMeta?.symbol || mint.slice(0, 2)}
                  size={36}
                />
                <div className="min-w-0">
                  <div className="text-lg font-semibold leading-tight">
                    {scanRecord?.tokenMeta?.name || scanRecord?.tokenMeta?.symbol || "Token"}
                  </div>
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
              <TokenAvatar
                imageUrl={scanRecord?.tokenMeta?.imageUrl}
                symbol={scanRecord?.tokenMeta?.symbol || mint.slice(0, 2)}
                size={36}
              />
              <div className="min-w-0">
                <div className="text-lg font-semibold leading-tight">
                  {scanRecord?.tokenMeta?.name || scanRecord?.tokenMeta?.symbol || "Token"}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">{mint}</div>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">{t("ui.grade")}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{grade || "—"}</div>
            <div className="mt-1">
              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", riskLabelPill(riskLabel))}>
                {riskLabel}
              </span>
            </div>
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
              <div className="text-5xl font-semibold">{score !== null ? score : "—"}</div>
              <div className="text-sm text-muted-foreground">({grade || "—"})</div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards from report */}
      {summary.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {summary.map((item) => (
            <div key={item.id} className="min-w-0 rounded-3xl border border-surface/40 bg-surface/30 p-4 backdrop-blur-xl">
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="mt-2 text-sm text-muted-foreground">{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Refreshing scan data...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded-3xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="text-sm text-red-300">{error}</div>
        </div>
      )}

      {/* Findings */}
      {findings.length > 0 ? (
        <div className="mt-4">
          <FindingDetails items={findings} />
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-surface/40 bg-surface/30 p-4 backdrop-blur-xl">
          <div className="text-sm text-muted-foreground">No findings available</div>
        </div>
      )}

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

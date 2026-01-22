"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const steps = [
  "Validating mint",
  "Fetching creators",
  "Reading liquidity signals",
  "Heuristic risk checks",
  "Finalizing score",
];

function isBase58Mint(v: string) {
  const s = (v || "").trim();
  if (s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

export function ScanLoadingRadar({ mint }: { mint: string }) {
  const router = useRouter();
  const mintTrimmed = (mint || "").trim();

  const valid = useMemo(() => isBase58Mint(mintTrimmed), [mintTrimmed]);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!valid) return;
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 1200);
    return () => clearInterval(t);
  }, [valid]);

  useEffect(() => {
    if (!valid) return;
    if (i === steps.length - 1) {
      const t = setTimeout(() => router.push(`/scan/result/${mintTrimmed}`), 500);
      return () => clearTimeout(t);
    }
  }, [i, valid, mintTrimmed, router]);

  if (!valid) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-surface/30 p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold">Invalid mint</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Please enter a valid Base58 mint address.
        </p>
      </div>
    );
  }

  const pct = Math.round(((i + 1) / steps.length) * 100);

  return (
    <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 backdrop-blur-xl">
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative h-24 w-24 shrink-0">
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-pulse" />
          <div className="absolute inset-3 rounded-full border border-primary/25" />
          <div className="absolute inset-6 rounded-full border border-primary/30" />
          <div className="absolute inset-9 rounded-full border border-primary/40" />
          <div className="absolute inset-[42px] grid place-items-center text-xl">🛡️</div>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Scanning…</h2>
          <p className="mt-1 text-sm text-muted-foreground truncate">{mintTrimmed}</p>

          <div className="mt-3 h-2 w-full rounded-full bg-muted/40">
            <div className="h-2 rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{pct}%</p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {steps.map((s, idx) => {
          const done = idx < i;
          const cur = idx === i;
          return (
            <div
              key={s}
              className={cn(
                "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm",
                "border-surface/40 bg-surface/20"
              )}
            >
              <span className={cn(done ? "text-foreground" : "text-muted-foreground")}>{s}</span>
              <span className={cn(done ? "text-emerald-400" : cur ? "text-primary" : "text-muted-foreground")}>
                {done ? "✓" : cur ? "⟳" : "•"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

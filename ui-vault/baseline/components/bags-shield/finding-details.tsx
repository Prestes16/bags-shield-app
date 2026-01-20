"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type FindingSeverity = "ok" | "attention" | "high";

export type Finding = {
  id: string;
  title: string;
  severity: FindingSeverity;
  summary?: string;
  details?: string | string[];
  hint?: string;
};

function Badge({ severity }: { severity: FindingSeverity }) {
  const map = {
    ok: { label: "OK", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/25" },
    attention: { label: "Attention", cls: "bg-amber-500/20 text-amber-100 border-amber-400/25" },
    high: { label: "High", cls: "bg-red-500/20 text-red-100 border-red-400/25" },
  } as const;

  const v = map[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur",
        v.cls
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current opacity-80" />
      {v.label}
    </span>
  );
}

function normalizeDetails(details?: string | string[]) {
  if (!details) return [];
  return Array.isArray(details) ? details : [details];
}

export default function FindingDetails({
  title = "Findings",
  items,
  className,
}: {
  title?: string;
  items: Finding[];
  className?: string;
}) {
  return (
    <section className={cn("w-full", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="grid gap-3">
        {items.map((f) => {
          const det = normalizeDetails(f.details);
          const hasMore = det.length > 0 || !!f.hint;

          return (
            <div
              key={f.id}
              className={cn(
                "rounded-2xl border border-surface/50 bg-surface/40 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-xl"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-foreground">
                      {f.title}
                    </h4>
                  </div>
                  {f.summary ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {f.summary}
                    </p>
                  ) : null}
                </div>

                <Badge severity={f.severity} />
              </div>

              {hasMore ? (
                <details className="mt-3">
                  <summary className="cursor-pointer select-none text-xs font-medium text-primary/90 hover:text-primary">
                    Details
                  </summary>

                  <div className="mt-2 space-y-2">
                    {det.length ? (
                      <ul className="list-disc space-y-1 pl-4 text-xs text-foreground/85">
                        {det.map((line, i) => (
                          <li key={i} className="leading-relaxed">
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {f.hint ? (
                      <div className="rounded-xl border border-surface/60 bg-black/10 p-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">Hint: </span>
                        {f.hint}
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

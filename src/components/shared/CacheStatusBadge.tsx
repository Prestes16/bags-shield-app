"use client";

import { cn } from "@/lib/utils";

export interface CacheStatusBadgeProps {
  fromCache?: boolean;
  stale?: boolean;
  source?: string;
  className?: string;
}

/**
 * Badge to indicate cache status (offline/degraded mode)
 */
export function CacheStatusBadge({
  fromCache,
  stale,
  source,
  className,
}: CacheStatusBadgeProps) {
  if (!fromCache && source !== "rpc_fallback") {
    return null; // Not using cache or fallback, no badge needed
  }

  const isDegraded = fromCache || source === "rpc_fallback";
  const label = stale
    ? "Stale data (refreshing...)"
    : fromCache
    ? "Cached data"
    : source === "rpc_fallback"
    ? "Degraded mode (RPC fallback)"
    : "Offline mode";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm",
        isDegraded
          ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
          : "border-slate-500/40 bg-slate-500/15 text-slate-200",
        className
      )}
      title={label}
    >
      <div
        className={cn(
          "h-2 w-2 rounded-full flex-shrink-0",
          stale 
            ? "bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50" 
            : "bg-current"
        )}
      />
      <span>{label}</span>
    </div>
  );
}

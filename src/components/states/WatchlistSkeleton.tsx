export function WatchlistSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface/40 bg-surface/30 p-4 backdrop-blur-xl">
          <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-9 w-full animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-4 w-24 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

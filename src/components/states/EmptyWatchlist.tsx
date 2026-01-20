"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function EmptyWatchlist() {
  const router = useRouter();
  return (
    <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 text-center backdrop-blur-xl">
      <div className="mx-auto mb-3 text-4xl">🛡️</div>
      <h3 className="text-lg font-semibold">Sua watchlist está vazia</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Adicione tokens pra monitorar alertas e ShieldScore.
      </p>
      <div className="mt-4">
        <Button onClick={() => router.push("/scan")} className="w-full">
          Add Token
        </Button>
      </div>
    </div>
  );
}

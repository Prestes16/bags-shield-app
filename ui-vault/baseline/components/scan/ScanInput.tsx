"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isBase58Mint(v: string) {
  const s = (v || "").trim();
  if (s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

export function ScanInput() {
  const router = useRouter();
  const [mint, setMint] = useState("");

  const ok = useMemo(() => isBase58Mint(mint), [mint]);

  return (
    <div className="rounded-3xl border border-surface/40 bg-surface/30 p-5 backdrop-blur-xl">
      <h2 className="text-lg font-semibold">Scan token</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cole o mint address (Base58) e rode o scan.
      </p>

      <div className="mt-4">
        <label className="text-xs text-muted-foreground">Mint Address</label>
        <input
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="So11111111111111111111111111111111111111112"
          className={cn(
            "mt-2 w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none",
            ok ? "border-surface/50" : "border-red-500/40"
          )}
        />
        {!ok && mint.trim().length > 0 ? (
          <p className="mt-2 text-xs text-red-400">Mint inválido (Base58 32–44 chars).</p>
        ) : null}
      </div>

      <div className="mt-4 flex gap-3">
        <Button
          className="w-full"
          disabled={!ok}
          onClick={() => router.push(`/scan/loading?mint=${encodeURIComponent(mint.trim())}`)}
        >
          Scan now
        </Button>
      </div>
    </div>
  );
}

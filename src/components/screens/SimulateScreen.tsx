"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";

export function SimulateScreen() {
  const router = useRouter();
  return (
    <AppShell title="Simulate" subtitle="Simulação de trade (placeholder UI)">
      <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 backdrop-blur-xl">
        <p className="text-sm text-muted-foreground">
          Aqui vamos plugar a simulação real (/api/simulate) depois.
        </p>
        <div className="mt-4">
          <Button onClick={() => router.push("/simulate/result")}>Simulate trade</Button>
        </div>
      </div>
    </AppShell>
  );
}

import { AppShell } from "@/components/shared/AppShell";

export function SimulateResultScreen() {
  return (
    <AppShell title="Simulate Result" subtitle="Resultado da simulação (placeholder)">
      <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 backdrop-blur-xl">
        <div className="text-sm font-semibold">No data yet</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Quando a API real estiver ok, aqui vai mostrar slippage, fees, route e warnings.
        </p>
      </div>
    </AppShell>
  );
}

import { AppShell } from "@/components/shared/AppShell";

export function AlertsScreen() {
  return (
    <AppShell title="Alerts" subtitle="Configurações e notificações (placeholder)">
      <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold">Em construção</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Aqui vamos ligar regras de alerta (score cai, creator change, liquidity flags, etc).
        </p>
      </div>
    </AppShell>
  );
}

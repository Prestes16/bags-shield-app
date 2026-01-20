import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";

export function ApplyScreen() {
  return (
    <AppShell title="Apply" subtitle="Aplicar proteções (placeholder UI)">
      <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 backdrop-blur-xl">
        <p className="text-sm text-muted-foreground">
          Aqui vamos ligar /api/apply (idempotência + confirmação) depois.
        </p>
        <div className="mt-4">
          <Button disabled>Apply protections</Button>
        </div>
      </div>
    </AppShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";
import { getStoredTheme, setTheme } from "@/components/shared/theme";

export function SettingsScreen() {
  const [cur, setCur] = useState<"default"|"neon"|"ice">("default");

  useEffect(() => {
    setCur(getStoredTheme());
  }, []);

  function apply(t: "default"|"neon"|"ice") {
    setTheme(t);
    setCur(t);
  }

  return (
    <AppShell title="Settings" subtitle="Tema e preferências">
      <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 backdrop-blur-xl">
        <div className="text-sm font-semibold">Tema</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Default continua padrão. Neon e Ice são add-ons.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant={cur==="default" ? "default" : "secondary"} onClick={() => apply("default")}>
            Default (Dark)
          </Button>
          <Button variant={cur==="neon" ? "default" : "secondary"} onClick={() => apply("neon")}>
            Neon (Green)
          </Button>
          <Button variant={cur==="ice" ? "default" : "secondary"} onClick={() => apply("ice")}>
            Ice (Light)
          </Button>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          Dica: <code>{`localStorage.setItem("bags_theme","neon");location.reload()`}</code>
        </div>
      </div>
    </AppShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";
import { getStoredTheme, setTheme } from "@/components/shared/theme";
import { WalletDetected } from "@/components/wallet/WalletDetected";

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
      <div className="rounded-3xl border border-surface/40 bg-surface/30 p-6 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-primary text-lg">🎨</span>
          </div>
          <div>
            <div className="text-sm font-semibold">Theme</div>
            <p className="text-xs text-muted-foreground">
              Choose your preferred color scheme
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Button 
            variant={cur==="default" ? "default" : "secondary"} 
            onClick={() => apply("default")}
            className="h-auto py-3 flex flex-col items-center gap-1"
          >
            <span className="text-lg">🌙</span>
            <span>Default (Dark)</span>
          </Button>
          <Button 
            variant={cur==="neon" ? "default" : "secondary"} 
            onClick={() => apply("neon")}
            className="h-auto py-3 flex flex-col items-center gap-1"
          >
            <span className="text-lg">💚</span>
            <span>Neon (Green)</span>
          </Button>
          <Button 
            variant={cur==="ice" ? "default" : "secondary"} 
            onClick={() => apply("ice")}
            className="h-auto py-3 flex flex-col items-center gap-1"
          >
            <span className="text-lg">❄️</span>
            <span>Ice (Light)</span>
          </Button>
        </div>

        <div className="mt-6 rounded-xl border border-surface/40 bg-surface/20 p-3">
          <div className="text-xs text-muted-foreground">
            💡 Tip: You can also set theme via <code className="bg-surface/30 px-1.5 py-0.5 rounded">localStorage.setItem(&quot;bags_theme&quot;,&quot;neon&quot;);location.reload()</code>
          </div>
        </div>
      </div>

      {/* Wallet Connection */}
      <div className="mt-6">
        <WalletDetected
          onConnect={(publicKey) => {
            console.log("Wallet connected:", publicKey);
          }}
          onDisconnect={() => {
            console.log("Wallet disconnected");
          }}
        />
      </div>
    </AppShell>
  );
}

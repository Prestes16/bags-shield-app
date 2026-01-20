import * as React from "react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/shared/BottomNav";

type Props = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  showNav?: boolean;
};

export function AppShell({ title, subtitle, children, showNav = true }: Props) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_0%,hsl(var(--primary)/0.18),transparent_55%)]" />
        <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_30%,rgba(79,209,255,0.10),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(47,167,255,0.10),transparent_40%)]" />
      </div>

      <div className={cn("relative mx-auto w-full max-w-2xl px-4 pt-6", showNav && "safe-bottom")}>
        {(title || subtitle) && (
          <header className="mb-4">
            {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </header>
        )}
        {children}
      </div>

      {showNav ? <BottomNav /> : null}
    </div>
  );
}

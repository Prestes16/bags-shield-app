"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconHome, IconSearch, IconBell, IconClock, IconSettings } from "@/components/shared/icons";

const items = [
  { href: "/home", label: "Home", icon: IconHome },
  { href: "/search", label: "Search", icon: IconSearch },
  { href: "/watchlist", label: "Watchlist", icon: IconBell },
  { href: "/history", label: "History", icon: IconClock },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export function BottomNav() {
  const path = usePathname() || "/";
  return (
    <nav className={cn(
      "bottom-nav fixed bottom-0 left-0 right-0 z-50",
      "border-t border-surface/40 bg-surface/40 backdrop-blur-xl"
    )}>
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-2">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={it.label}
            >
              <Icon className={cn("h-5 w-5", active ? "drop-shadow" : "")} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

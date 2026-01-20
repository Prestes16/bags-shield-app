"use client";

export type AppTheme = "default" | "neon" | "ice";

const KEY = "bags_theme";

export function getStoredTheme(): AppTheme {
  const t = (typeof window !== "undefined" && localStorage.getItem(KEY)) || "default";
  return (t === "neon" || t === "ice" || t === "default") ? t : "default";
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.remove("theme-neon", "theme-ice");

  if (theme === "neon") {
    root.classList.add("theme-neon");
    root.classList.add("dark");
  } else if (theme === "ice") {
    root.classList.add("theme-ice");
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
  }
}

export function setTheme(theme: AppTheme) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function themeLabel(theme: AppTheme) {
  if (theme === "default") return "Original";
  if (theme === "neon") return "Dark + Neon";
  return "White + Cyan";
}

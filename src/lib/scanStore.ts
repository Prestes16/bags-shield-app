/**
 * localStorage-backed scan record store
 * Safe for SSR: guards typeof window === "undefined"
 */

import { TokenMeta } from "./tokenMeta";
import { ScanReportNormalized } from "./scanTypes";

export type ScanRecord = {
  mint: string;
  score: number;
  grade: string;
  risk: "low" | "medium" | "high";
  scannedAt: number;
  source: "scan" | "scam_history";
  frozen?: boolean; // If true, grade should not change unless user rescans
  tokenMeta?: TokenMeta; // Token metadata from backend (if available)
  report?: ScanReportNormalized; // Full normalized scan report
  fetchedAt?: number; // Timestamp when report was fetched
};

const STORE_KEY = "bagsShield.scanRecords";

function getStore(): Record<string, ScanRecord> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

function setStore(store: Record<string, ScanRecord>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Fail silently
  }
}

/**
 * Get scan record for a mint
 */
export function getScanRecord(mint: string): ScanRecord | null {
  if (typeof window === "undefined") return null;
  const store = getStore();
  return store[mint] || null;
}

/**
 * Set scan record (from scan API)
 */
export function setScanRecord(record: ScanRecord): void {
  if (typeof window === "undefined") return;
  const store = getStore();
  store[record.mint] = record;
  setStore(store);
}

/**
 * Mark token as known scam history (frozen grade)
 */
export function markKnownScamHistory(mint: string, record: Omit<ScanRecord, "source" | "frozen">): void {
  if (typeof window === "undefined") return;
  const store = getStore();
  store[mint] = {
    ...record,
    source: "scam_history",
    frozen: true, // Scam history grades are frozen
  };
  setStore(store);
}

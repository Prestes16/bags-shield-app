/**
 * Normalized scan report type for UI consumption
 * All fields are optional except mint; missing data shows as "—"
 */

import { TokenMeta } from "./tokenMeta";

export type ScanGrade = "A" | "B" | "C" | "D" | "E" | null;
export type RiskLabel = "Low" | "Medium" | "High" | "Critical" | "Unknown";
export type FindingSeverity = "low" | "medium" | "high" | "critical";

export interface ScanFinding {
  id: string;
  title: string;
  description?: string;
  severity?: FindingSeverity;
  details?: string;
}

export interface ScanReportNormalized {
  mint: string;
  tokenMeta?: TokenMeta;
  shieldScore: number | null;
  grade: ScanGrade;
  riskLabel: RiskLabel;
  findings: ScanFinding[];
  // Optional sections
  authorities?: {
    freezeAuthority?: string | null;
    mintAuthority?: string | null;
    updateAuthority?: string | null;
  };
  liquidity?: {
    locked?: boolean | null;
    amount?: number | null;
    poolAddress?: string | null;
  };
  holders?: {
    top10Concentration?: number | null;
    totalHolders?: number | null;
  };
  taxes?: {
    buyTax?: number | null;
    sellTax?: number | null;
  };
  metadata?: {
    decimals?: number | null;
    supply?: string | null;
    symbol?: string | null;
    name?: string | null;
  };
  route?: {
    method?: string | null;
    path?: string | null;
  };
  timestamps?: {
    scannedAt?: number | null;
    evaluatedAt?: string | null;
  };
}

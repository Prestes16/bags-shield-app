/**
 * Normalize backend scan response to UI-friendly format
 * Defensive: accepts multiple backend shapes, never throws
 */

import { ScanReportNormalized, ScanGrade, RiskLabel, ScanFinding } from "./scanTypes";
import { extractTokenMeta } from "./tokenMeta";

function deriveGrade(score: number | null | undefined): ScanGrade {
  if (score === null || score === undefined) return null;
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

function deriveRiskLabel(grade: ScanGrade, score: number | null | undefined): RiskLabel {
  if (grade === "A" || grade === "B") return "Low";
  if (grade === "C") return "Medium";
  if (grade === "D") return "High";
  if (grade === "E") return "Critical";
  if (score === null || score === undefined) return "Unknown";
  return "Unknown";
}

function extractFindings(raw: any): ScanFinding[] {
  if (!raw) return [];

  // Try various response shapes
  const findings = raw.findings || raw.risks || raw.issues || raw.warnings || [];

  if (!Array.isArray(findings)) return [];

  return findings
    .filter((f: any) => f && (f.id || f.title || f.name))
    .map((f: any, idx: number): ScanFinding => ({
      id: f.id || f.name || `finding-${idx}`,
      title: f.title || f.name || f.label || "Finding",
      description: f.description || f.desc || f.message || undefined,
      severity: f.severity || f.level || f.risk || undefined,
      details: f.details || f.info || f.note || undefined,
    }));
}

function extractAuthorities(raw: any): ScanReportNormalized["authorities"] {
  if (!raw) return undefined;

  const auth = raw.authorities || raw.authority || raw.permissions || {};
  if (typeof auth !== "object") return undefined;

  return {
    freezeAuthority: auth.freezeAuthority || auth.freeze || auth.hasFreezeAuthority || null,
    mintAuthority: auth.mintAuthority || auth.mint || auth.hasMintAuthority || null,
    updateAuthority: auth.updateAuthority || auth.update || auth.hasUpdateAuthority || null,
  };
}

function extractLiquidity(raw: any): ScanReportNormalized["liquidity"] {
  if (!raw) return undefined;

  const liq = raw.liquidity || raw.liquidityInfo || {};
  if (typeof liq !== "object") return undefined;

  return {
    locked: liq.locked !== undefined ? liq.locked : liq.isLocked || null,
    amount: liq.amount || liq.value || null,
    poolAddress: liq.poolAddress || liq.pool || liq.address || null,
  };
}

function extractHolders(raw: any): ScanReportNormalized["holders"] {
  if (!raw) return undefined;

  const holders = raw.holders || raw.holderInfo || raw.distribution || {};
  if (typeof holders !== "object") return undefined;

  return {
    top10Concentration: holders.top10Concentration || holders.concentration || holders.top10 || null,
    totalHolders: holders.totalHolders || holders.count || holders.total || null,
  };
}

function extractTaxes(raw: any): ScanReportNormalized["taxes"] {
  if (!raw) return undefined;

  const taxes = raw.taxes || raw.fees || raw.tokenTaxes || {};
  if (typeof taxes !== "object") return undefined;

  return {
    buyTax: taxes.buyTax || taxes.buy || taxes.buyFee || null,
    sellTax: taxes.sellTax || taxes.sell || taxes.sellFee || null,
  };
}

function extractMetadata(raw: any): ScanReportNormalized["metadata"] {
  if (!raw) return undefined;

  const meta = raw.metadata || raw.tokenMetadata || raw.tokenInfo || {};
  if (typeof meta !== "object") return undefined;

  return {
    decimals: meta.decimals || null,
    supply: meta.supply || meta.totalSupply || meta.maxSupply || null,
    symbol: meta.symbol || raw.symbol || null,
    name: meta.name || raw.name || null,
  };
}

function extractRoute(raw: any): ScanReportNormalized["route"] {
  if (!raw) return undefined;

  const route = raw.route || raw.transactionRoute || {};
  if (typeof route !== "object") return undefined;

  return {
    method: route.method || null,
    path: route.path || route.endpoint || null,
  };
}

function extractTimestamps(raw: any): ScanReportNormalized["timestamps"] {
  if (!raw) return undefined;

  return {
    scannedAt: raw.scannedAt ? (typeof raw.scannedAt === "number" ? raw.scannedAt : Date.parse(raw.scannedAt) || null) : null,
    evaluatedAt: raw.evaluatedAt || raw.evaluated_at || raw.timestamp || null,
  };
}

/**
 * Normalize backend scan response to UI-friendly format
 * Never throws; returns best-effort normalized report
 */
export function normalizeScanResponse(raw: any, mint: string): ScanReportNormalized {
  if (!raw || typeof raw !== "object") {
    return {
      mint,
      shieldScore: null,
      grade: null,
      riskLabel: "Unknown",
      findings: [],
    };
  }

  // Extract score from various shapes
  const score = raw.shieldScore ?? raw.score ?? raw.securityScore ?? raw.riskScore ?? null;
  const grade = deriveGrade(score);
  const riskLabel = deriveRiskLabel(grade, score);

  // Extract token metadata
  const tokenMeta = extractTokenMeta(raw);

  // Extract findings
  const findings = extractFindings(raw);

  // Build normalized report
  const report: ScanReportNormalized = {
    mint,
    tokenMeta: tokenMeta || undefined,
    shieldScore: score,
    grade,
    riskLabel,
    findings,
  };

  // Extract optional sections (only if they exist)
  const authorities = extractAuthorities(raw);
  if (authorities && Object.values(authorities).some((v) => v !== null && v !== undefined)) {
    report.authorities = authorities;
  }

  const liquidity = extractLiquidity(raw);
  if (liquidity && Object.values(liquidity).some((v) => v !== null && v !== undefined)) {
    report.liquidity = liquidity;
  }

  const holders = extractHolders(raw);
  if (holders && Object.values(holders).some((v) => v !== null && v !== undefined)) {
    report.holders = holders;
  }

  const taxes = extractTaxes(raw);
  if (taxes && Object.values(taxes).some((v) => v !== null && v !== undefined)) {
    report.taxes = taxes;
  }

  const metadata = extractMetadata(raw);
  if (metadata && Object.values(metadata).some((v) => v !== null && v !== undefined)) {
    report.metadata = metadata;
  }

  const route = extractRoute(raw);
  if (route && Object.values(route).some((v) => v !== null && v !== undefined)) {
    report.route = route;
  }

  const timestamps = extractTimestamps(raw);
  if (timestamps && Object.values(timestamps).some((v) => v !== null && v !== undefined)) {
    report.timestamps = timestamps;
  }

  return report;
}

/**
 * Score Policy: Controls when scores can be displayed
 */

export const SCORE_POLICY = {
  requireScanForScore: true,
  allowHistoricalScore: true,
};

export interface ScorePolicyInput {
  hasScanResult: boolean;
  isKnownScamHistory: boolean;
}

// Simple i18n helper
const i18n: Record<string, Record<string, string>> = {
  en: {
    "score.not_scanned": "Not scanned",
    "score.scanned": "Scanned",
    "score.known_scam_history": "Known scam history",
  },
  ptBR: {
    "score.not_scanned": "Não escaneado",
    "score.scanned": "Escaneado",
    "score.known_scam_history": "Histórico de scam conhecido",
  },
};

function t(key: string, lang: string = "en"): string {
  return i18n[lang]?.[key] || i18n.en[key] || key;
}

/**
 * Determines if score should be shown based on policy
 */
export function shouldShowScore(input: ScorePolicyInput): boolean {
  // Exception: known scam history can show frozen grade
  if (input.isKnownScamHistory && SCORE_POLICY.allowHistoricalScore) {
    return true;
  }

  // Default: require scan result
  if (SCORE_POLICY.requireScanForScore) {
    return input.hasScanResult;
  }

  // Fallback: allow if policy doesn't require scan
  return true;
}

/**
 * Returns label for score state
 */
export function scoreLabel(
  input: ScorePolicyInput,
  lang: string = "en"
): "Not scanned" | "Scanned" | "Known scam history" {
  if (input.isKnownScamHistory) {
    return t("score.known_scam_history", lang) as "Known scam history";
  }
  if (input.hasScanResult) {
    return t("score.scanned", lang) as "Scanned";
  }
  return t("score.not_scanned", lang) as "Not scanned";
}

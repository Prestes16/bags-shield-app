/**
 * Minimal i18n helper for UI strings
 * English as default, pt-BR support
 */

const i18n: Record<string, Record<string, string>> = {
  en: {
    "ui.not_scanned": "Not scanned",
    "ui.scan_now": "Scan now",
    "ui.scam_history": "Scam history",
    "ui.scanned": "Scanned",
    "ui.watchlist_subtitle": "Alerts and ShieldScore for tokens you follow",
    "ui.history_subtitle": "Recent scans",
    "ui.scan_result_subtitle": "ShieldScore + Findings",
    "ui.token_not_scanned": "Token not scanned",
    "ui.shield_score": "ShieldScore",
    "ui.grade": "Grade",
    "ui.scan_again": "Scan again",
    "ui.share": "Share",
    "ui.simulate": "Simulate",
    "error.backend_html": "Backend returned HTML instead of JSON. Check BAGS_SHIELD_API_BASE and /api/scan proxy configuration.",
    "error.scan_failed": "Scan failed",
    "error.invalid_response": "Invalid response from backend",
  },
  ptBR: {
    "ui.not_scanned": "Não escaneado",
    "ui.scan_now": "Escanear agora",
    "ui.scam_history": "Histórico de scam",
    "ui.scanned": "Escaneado",
    "ui.watchlist_subtitle": "Alertas e ShieldScore dos tokens que você acompanha",
    "ui.history_subtitle": "Últimos scans executados",
    "ui.scan_result_subtitle": "ShieldScore + Findings",
    "ui.token_not_scanned": "Token não escaneado",
    "ui.shield_score": "ShieldScore",
    "ui.grade": "Nota",
    "ui.scan_again": "Escanear novamente",
    "ui.share": "Compartilhar",
    "ui.simulate": "Simular",
    "error.backend_html": "Backend retornou HTML ao invés de JSON. Verifique BAGS_SHIELD_API_BASE e configuração do proxy /api/scan.",
    "error.scan_failed": "Falha no scan",
    "error.invalid_response": "Resposta inválida do backend",
  },
};

export function t(key: string, lang: string = "en"): string {
  return i18n[lang]?.[key] || i18n.en[key] || key;
}

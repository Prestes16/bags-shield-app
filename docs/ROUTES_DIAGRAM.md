# Diagrama de Rotas e Fluxo de Dados

## 🔄 Fluxo Principal: Scan de Token

```
┌─────────────────────────────────────────────────────────────────┐
│                    USUÁRIO                                       │
│  Digita mint em /scan → Clica "Scan now"                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              /scan/loading (ScanLoadingClient.tsx)               │
│  • POST /api/scan {mint: "So111..."}                             │
│  • Aguarda resposta                                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              /api/scan (route.ts) - PROXY ROBUSTO                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Valida mint (Base58, 32-44 chars)                            │
│     ❌ Inválido → 400 "Invalid mint"                             │
│                                                                   │
│  2. BAGS_SHIELD_API_BASE configurado?                           │
│     ❌ Não → Fallback on-chain imediato                          │
│     ✅ Sim → Continua                                            │
│                                                                   │
│  3. Tenta backend (timeout 15s):                                 │
│     • ${base}/api/scan                                           │
│     • ${base}/api/v0/scan (fallback)                            │
│                                                                   │
│  4. Backend retornou JSON?                                       │
│     ✅ Sim → Repassa resposta                                    │
│     ❌ HTML/Erro → Fallback on-chain                             │
│                                                                   │
│  5. Fallback on-chain (se necessário):                           │
│     • Solana RPC: getAccountInfo(mint)                           │
│     • Solana RPC: getTokenLargestAccounts(mint)                  │
│     • Parse SPL Token layout                                     │
│     • Calcula top10Concentration                                 │
│     • Gera findings baseados em autoridades                     │
│                                                                   │
│  6. Retorna {success, response} ou {success: false, error}      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              ScanLoadingClient.tsx (continuação)                  │
│  • Recebe resposta                                               │
│  • normalizeScanResponse() → ScanReportNormalized               │
│  • setScanRecord({mint, score, grade, risk, report, ...})        │
│  • Salva no localStorage (scanStore)                              │
│  • Navega para /scan/result/[mint]                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              /scan/result/[mint] (page.tsx)                      │
│  • getScanRecord(mint) → Lê do scanStore                        │
│  • Se report incompleto → Refresh automático                     │
│  • Renderiza:                                                    │
│    - Score, Grade, RiskLabel                                     │
│    - Findings                                                    │
│    - Summary cards (liquidity, authorities, holders, taxes)      │
│    - TokenAvatar (se imageUrl disponível)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔀 Outras Rotas de Proxy

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENTE                                       │
│  POST /api/simulate | /api/apply | /api/launchpad/ping          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              forwardToBackend() (proxy.ts)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Verifica BAGS_SHIELD_API_BASE                                │
│     ❌ Não → 501 "MISSING_BAGS_SHIELD_API_BASE"                  │
│                                                                   │
│  2. OPTIONS? → CORS preflight (204)                              │
│                                                                   │
│  3. Filtra headers (request → backend):                          │
│     • accept, content-type, authorization                        │
│     • x-request-id (gera se não existir)                        │
│     • x-correlation-id, x-api-key, accept-language                │
│                                                                   │
│  4. Forward para: ${BAGS_SHIELD_API_BASE}${backendPath}         │
│     • Timeout: 20s (configurável)                                 │
│                                                                   │
│  5. Filtra headers (response → cliente):                         │
│     • Remove: connection, keep-alive, transfer-encoding, etc.     │
│     • Mantém: content-type, x-request-id, x-ratelimit-*         │
│     • Força: cache-control: no-store                            │
│                                                                   │
│  6. Retorna response (status + body + headers filtrados)         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Estrutura de Dados

### Request Envelope (Padrão)
```json
{
  "mint": "So11111111111111111111111111111111111111112"
}
```

### Response Envelope (Padrão)
```json
{
  "success": true,
  "response": {
    "mint": "...",
    "tokenMeta": {
      "mint": "...",
      "symbol": "SOL",
      "name": "Solana",
      "imageUrl": "https://..."
    },
    "shieldScore": 85,
    "grade": "A",
    "riskLabel": "Low",
    "findings": [
      {
        "id": "mint-authority",
        "title": "Mint Authority Present",
        "description": "...",
        "severity": "high",
        "details": "..."
      }
    ],
    "authorities": {
      "mintAuthority": null,
      "freezeAuthority": null,
      "updateAuthority": null
    },
    "metadata": {
      "decimals": 9,
      "supply": "1000000000",
      "symbol": "SOL",
      "name": "Solana"
    },
    "holders": {
      "top10Concentration": 45.2,
      "totalHolders": 150
    }
  }
}
```

### Error Envelope
```json
{
  "success": false,
  "error": "Mint account not found on-chain."
}
```

---

## 🗂️ Mapa de Arquivos

### API Routes
```
src/app/api/
├── scan/
│   └── route.ts          → Proxy robusto + fallback on-chain
├── simulate/
│   └── route.ts          → Proxy genérico
├── apply/
│   └── route.ts          → Proxy genérico
├── launchpad/
│   └── ping/
│       └── route.ts       → Proxy genérico
└── ping/
    └── route.ts          → Health check local
```

### Frontend Pages
```
src/app/
├── page.tsx              → Redireciona para /home
├── home/
│   └── page.tsx          → HomeScreen (Connect Wallet, Quick Scan)
├── scan/
│   ├── page.tsx          → ScanScreen (input mint)
│   ├── loading/
│   │   └── page.tsx      → ScanLoadingClient (chama /api/scan)
│   └── result/
│       └── [mint]/
│           └── page.tsx  → Renderiza resultado do scan
├── watchlist/
│   └── page.tsx          → WatchlistScreen (usa scanStore)
├── history/
│   └── page.tsx          → HistoryScreen (usa scanStore)
└── ...
```

### Libraries
```
src/lib/
├── proxy.ts              → forwardToBackend() genérico
├── solanaRpc.ts          → Cliente RPC Solana (on-chain fallback)
├── scanStore.ts          → localStorage-backed store
├── scanTypes.ts          → ScanReportNormalized type
├── scanNormalize.ts      → normalizeScanResponse()
├── tokenMeta.ts          → TokenMeta type + extractTokenMeta()
├── scorePolicy.ts        → shouldShowScore(), scoreLabel()
└── i18n.ts               → Helper i18n (EN/PT-BR)
```

---

## 🔐 Score Policy Flow

```
Token aparece em Watchlist/History
         ↓
getScanRecord(mint)
         ↓
hasScanResult = !!scanRecord
isKnownScamHistory = scanRecord?.source === "scam_history"
         ↓
shouldShowScore({hasScanResult, isKnownScamHistory})
         ↓
┌─────────────────────────────────────┐
│  ✅ hasScanResult = true            │ → Mostra score
│  ✅ isKnownScamHistory = true       │ → Mostra score (congelado)
│  ❌ hasScanResult = false           │ → "Not scanned" + CTA
└─────────────────────────────────────┘
```

---

## 🌐 Environment Variables

```bash
# .env.local

# Backend Bags Shield API (server-side)
BAGS_SHIELD_API_BASE=https://bags-shield-api.vercel.app

# Solana RPC (opcional, para fallback on-chain)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## ⚡ Timeouts e Limites

| Operação | Timeout | Notas |
|----------|---------|-------|
| Backend proxy (`/api/scan`) | 15s | Tenta 2 caminhos |
| Generic proxy (`forwardToBackend`) | 20s | Configurável |
| Solana RPC (mint account) | 10s | Por chamada |
| Solana RPC (largest accounts) | 10s | Por chamada |
| Total fallback on-chain | ~20s | 2 chamadas paralelas |

---

## 🛡️ Segurança e Validação

### Validação de Mint
- ✅ Base58: `^[1-9A-HJ-NP-Za-km-z]+$`
- ✅ Tamanho: 32-44 caracteres
- ✅ Sem caracteres ambíguos: 0, O, I, l

### Headers Seguros
- ✅ Allowlist de headers forwardados
- ✅ Filtragem de hop-by-hop headers
- ✅ Geração de `x-request-id` único

### Detecção de Erros
- ✅ HTML vs JSON detection
- ✅ Content-type validation
- ✅ Timeout handling
- ✅ Graceful fallback

---

## 📝 Notas Finais

1. **`/api/scan`** é a única rota com fallback on-chain
2. **Outras rotas** retornam 501 se `BAGS_SHIELD_API_BASE` não configurado
3. **Todos os proxies** filtram headers hop-by-hop
4. **Todos os responses** têm `cache-control: no-store`
5. **ScanStore** persiste no `localStorage` (SSR-safe)
6. **Score Policy** garante que score só aparece após scan bem-sucedido

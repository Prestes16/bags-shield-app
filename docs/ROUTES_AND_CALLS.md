# Esquema Completo de Rotas e Chamadas

## 📋 Índice
1. [Rotas da API (Next.js API Routes)](#rotas-da-api)
2. [Rotas do Frontend (Pages)](#rotas-do-frontend)
3. [Fluxo de Chamadas](#fluxo-de-chamadas)
4. [Estrutura de Proxy](#estrutura-de-proxy)
5. [Fallbacks e Resiliência](#fallbacks-e-resiliência)

---

## 🔌 Rotas da API (Next.js API Routes)

### `/api/scan` (POST)
**Arquivo:** `src/app/api/scan/route.ts`

**Funcionalidade:**
- Proxy robusto com fallback on-chain Solana
- Validação Base58 do mint
- Detecção de HTML vs JSON
- Múltiplos caminhos de fallback

**Fluxo:**
```
POST /api/scan
  ↓
1. Valida mint (Base58, 32-44 chars)
  ↓
2. Se BAGS_SHIELD_API_BASE não configurado:
   → Fallback on-chain imediato
  ↓
3. Tenta backend:
   - ${base}/api/scan
   - ${base}/api/v0/scan
  ↓
4. Se backend retorna HTML ou unreachable:
   → Fallback on-chain Solana
  ↓
5. Retorna {success, response} ou {success: false, error}
```

**Request:**
```json
{
  "mint": "So11111111111111111111111111111111111111112"
}
```

**Response (sucesso):**
```json
{
  "success": true,
  "response": {
    "mint": "...",
    "tokenMeta": {...},
    "shieldScore": 85,
    "grade": "A",
    "riskLabel": "Low",
    "findings": [...],
    "authorities": {...},
    "metadata": {...},
    "holders": {...}
  }
}
```

**Fallback On-Chain:**
- Usa `SOLANA_RPC_URL` (default: `https://api.mainnet-beta.solana.com`)
- Busca: `mintAuthority`, `freezeAuthority`, `supply`, `decimals`
- Calcula: `top10Concentration` via `getTokenLargestAccounts`
- Retorna findings baseados em autoridades e concentração

---

### `/api/simulate` (GET/POST/OPTIONS)
**Arquivo:** `src/app/api/simulate/route.ts`

**Funcionalidade:**
- Proxy genérico usando `forwardToBackend()`
- Repassa para `${BAGS_SHIELD_API_BASE}/api/simulate`

**Métodos:**
- `GET` → Proxy
- `POST` → Proxy
- `OPTIONS` → CORS preflight

---

### `/api/apply` (GET/POST/OPTIONS)
**Arquivo:** `src/app/api/apply/route.ts`

**Funcionalidade:**
- Proxy genérico usando `forwardToBackend()`
- Repassa para `${BAGS_SHIELD_API_BASE}/api/apply`

---

### `/api/launchpad/ping` (GET/POST/OPTIONS)
**Arquivo:** `src/app/api/launchpad/ping/route.ts`

**Funcionalidade:**
- Proxy genérico usando `forwardToBackend()`
- Repassa para `${BAGS_SHIELD_API_BASE}/api/launchpad/ping`

---

### `/api/ping` (Local Health Check)
**Arquivo:** `src/app/api/ping/route.ts`

**Funcionalidade:**
- Health check local do app Next.js
- **NÃO** faz proxy (fica local)

---

## 🎨 Rotas do Frontend (Pages)

### `/` (Home)
**Arquivo:** `src/app/page.tsx`
- Redireciona para `/home`

### `/home`
**Arquivo:** `src/app/home/page.tsx`
- Tela inicial com botões "Connect Wallet" e "Quick Scan"
- Usa `src/lib/wallet.ts` (Solana-only)

### `/scan`
**Arquivo:** `src/app/scan/page.tsx`
- Input de mint address
- Aceita query param `?mint=...` para pre-fill
- Navega para `/scan/loading?mint=...`

### `/scan/loading`
**Arquivo:** `src/app/scan/loading/page.tsx`
- Componente: `ScanLoadingClient.tsx`
- **Chamada API:** `POST /api/scan` com `{mint}`
- **Ações:**
  - Normaliza resposta com `normalizeScanResponse()`
  - Salva no `scanStore` via `setScanRecord()`
  - Navega para `/scan/result/[mint]`

### `/scan/result/[mint]`
**Arquivo:** `src/app/scan/result/[mint]/page.tsx`
- Lê do `scanStore` via `getScanRecord(mint)`
- Se report faltando/incompleto: faz refresh automático
- Renderiza score, grade, riskLabel, findings, summary cards

### `/simulate`
**Arquivo:** `src/app/simulate/page.tsx`
- Tela de simulação de transação

### `/watchlist`
**Arquivo:** `src/app/watchlist/page.tsx`
- Lista tokens monitorados
- Usa `scanStore` para verificar scores
- Aplica `scorePolicy` (só mostra score se escaneado)

### `/history`
**Arquivo:** `src/app/history/page.tsx`
- Histórico de scans
- Usa `scanStore` e `scorePolicy`

### `/dashboard`
**Arquivo:** `src/app/dashboard/page.tsx`
- Dashboard principal

---

## 🔄 Fluxo de Chamadas

### Fluxo de Scan Completo

```
1. Usuário entra mint em /scan
   ↓
2. Navega para /scan/loading?mint=...
   ↓
3. ScanLoadingClient.tsx:
   - POST /api/scan {mint}
   ↓
4. /api/scan route.ts:
   - Valida mint (Base58)
   - Tenta backend: ${BAGS_SHIELD_API_BASE}/api/scan
   - Se falhar: fallback on-chain Solana
   ↓
5. Resposta normalizada:
   - normalizeScanResponse() → ScanReportNormalized
   ↓
6. Salva no scanStore:
   - setScanRecord({mint, score, grade, risk, report, tokenMeta, ...})
   ↓
7. Navega para /scan/result/[mint]
   ↓
8. Scan Result Page:
   - Lê scanStore
   - Se incompleto: refresh automático
   - Renderiza dados do report
```

### Fluxo de Proxy Genérico

```
Cliente → /api/simulate (ou /api/apply, /api/launchpad/ping)
   ↓
forwardToBackend(req, "/api/simulate")
   ↓
1. Verifica BAGS_SHIELD_API_BASE
   ↓
2. Filtra headers (allowlist)
   - accept, content-type, authorization, x-request-id, etc.
   ↓
3. Gera x-request-id se não existir
   ↓
4. Forward para: ${BAGS_SHIELD_API_BASE}/api/simulate
   ↓
5. Filtra headers de resposta (remove hop-by-hop)
   ↓
6. Retorna response ao cliente
```

---

## 🛡️ Estrutura de Proxy

### `src/lib/proxy.ts` - `forwardToBackend()`

**Headers Forwardados (Request → Backend):**
- `accept`
- `content-type`
- `authorization`
- `x-request-id` (gerado se não existir)
- `x-correlation-id`
- `x-api-key`
- `accept-language`

**Headers Filtrados (Response → Cliente):**
- Remove hop-by-hop: `connection`, `keep-alive`, `transfer-encoding`, `content-length`, etc.
- Mantém: `content-type`, `x-request-id`, `x-ratelimit-*`, `retry-after`
- Força: `cache-control: no-store`

**OPTIONS (CORS Preflight):**
- Echo do `Origin` do request
- `access-control-allow-methods`: GET,POST,OPTIONS
- `access-control-allow-headers`: content-type, authorization, x-request-id, x-api-key

**Timeout:**
- Default: 20s
- Configurável via `opts.timeoutMs`

---

## 🔄 Fallbacks e Resiliência

### Fallback On-Chain Solana (`/api/scan`)

**Quando ativa:**
1. `BAGS_SHIELD_API_BASE` não configurado
2. Backend retorna HTML (erro/redirect)
3. Backend unreachable (timeout/network error)

**O que faz:**
1. Busca mint account via RPC Solana:
   - `getAccountInfo(mint, {encoding: "base64"})`
   - Parse SPL Token Mint layout (82 bytes)
   - Extrai: `mintAuthority`, `freezeAuthority`, `supply`, `decimals`

2. Busca largest accounts:
   - `getTokenLargestAccounts(mint)`
   - Calcula `top10Concentration`

3. Gera findings:
   - "Mint Authority Present" (severity: high)
   - "Freeze Authority Present" (severity: medium)
   - "High Holder Concentration" (severity: high/medium se >50%)

4. Retorna no mesmo formato:
   ```json
   {
     "success": true,
     "response": {
       "mint": "...",
       "tokenMeta": {"mint": "...", "symbol": "Unknown", "name": "Unknown"},
       "shieldScore": null,
       "grade": null,
       "riskLabel": "Unknown",
       "findings": [...],
       "authorities": {...},
       "metadata": {...},
       "holders": {...}
     }
   }
   ```

**Configuração:**
- `SOLANA_RPC_URL` (env var)
- Default: `https://api.mainnet-beta.solana.com`
- Timeout: 10s por chamada RPC

---

## 📦 Stores e Persistência

### `src/lib/scanStore.ts`

**Funções:**
- `getScanRecord(mint)` → `ScanRecord | null`
- `setScanRecord(record)` → void
- `markKnownScamHistory(mint, record)` → void

**ScanRecord:**
```typescript
{
  mint: string;
  score: number;
  grade: string;
  risk: "low" | "medium" | "high";
  scannedAt: number;
  source: "scan" | "scam_history";
  frozen?: boolean;
  tokenMeta?: TokenMeta;
  report?: ScanReportNormalized;
  fetchedAt?: number;
}
```

**Persistência:**
- `localStorage` key: `bagsShield.scanRecords`
- SSR-safe: guards `typeof window === "undefined"`

---

## 🔐 Score Policy

### `src/lib/scorePolicy.ts`

**Regras:**
- Score só aparece **depois** de scan bem-sucedido
- **Exceção:** tokens com `scam_history` podem mostrar grade congelada
- Se não escaneado: mostra "Not scanned" + botão "Scan now"

**Funções:**
- `shouldShowScore({hasScanResult, isKnownScamHistory})` → boolean
- `scoreLabel({hasScanResult, isKnownScamHistory})` → string

---

## 🌐 Variáveis de Ambiente

### `.env.local`

```bash
# Backend Bags Shield API (server-side, não precisa NEXT_PUBLIC)
BAGS_SHIELD_API_BASE=https://bags-shield-api.vercel.app

# Solana RPC (opcional, fallback on-chain)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## 📊 Resumo Visual

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js App)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /scan → ScanLoadingClient → POST /api/scan                  │
│    ↓                                                          │
│  /scan/result/[mint] → Lê scanStore → Renderiza report      │
│                                                               │
│  /watchlist → Lê scanStore → Aplica scorePolicy              │
│  /history → Lê scanStore → Aplica scorePolicy                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              API ROUTES (Next.js API Routes)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /api/scan (POST)                                            │
│    ├─ Valida mint (Base58)                                   │
│    ├─ Tenta: ${BAGS_SHIELD_API_BASE}/api/scan               │
│    ├─ Fallback: ${BAGS_SHIELD_API_BASE}/api/v0/scan         │
│    └─ Fallback: On-chain Solana RPC                          │
│                                                               │
│  /api/simulate (GET/POST/OPTIONS)                           │
│    └─ Proxy: forwardToBackend("/api/simulate")              │
│                                                               │
│  /api/apply (GET/POST/OPTIONS)                               │
│    └─ Proxy: forwardToBackend("/api/apply")                  │
│                                                               │
│  /api/launchpad/ping (GET/POST/OPTIONS)                      │
│    └─ Proxy: forwardToBackend("/api/launchpad/ping")        │
│                                                               │
│  /api/ping (GET)                                              │
│    └─ Health check local (NÃO faz proxy)                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Bags Shield API - Vercel)             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /api/scan → Retorna scan report completo                    │
│  /api/simulate → Retorna simulação                           │
│  /api/apply → Retorna decisão de apply                       │
│  /api/launchpad/ping → Status do Launchpad                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              FALLBACK: Solana RPC (On-Chain)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  getAccountInfo(mint) → Parse SPL Token Mint                 │
│  getTokenLargestAccounts(mint) → Top 10 concentration        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Detalhes Técnicos

### Validação de Mint
- Base58: `^[1-9A-HJ-NP-Za-km-z]+$`
- Tamanho: 32-44 caracteres
- Sem: 0, O, I, l

### Leitura de Body
- Usa `req.text()` (não `req.json()`)
- Parse manual com try/catch
- Evita consumo duplo do body stream

### Detecção de HTML
- Verifica `content-type: application/json`
- Detecta HTML: `<!doctype`, `<html`, `<head`, `<body`
- Se HTML: tenta próximo candidato ou fallback

### Timeouts
- Backend proxy: 15s (`/api/scan`)
- Generic proxy: 20s (default, configurável)
- Solana RPC: 10s por chamada

---

## 📝 Notas

- Todas as rotas API são `runtime: "nodejs"` e `dynamic: "force-dynamic"`
- Todas as respostas têm `cache-control: no-store`
- Headers hop-by-hop são sempre filtrados
- `x-request-id` é sempre gerado se não existir
- Fallback on-chain só funciona para `/api/scan`
- Outras rotas retornam 501 se `BAGS_SHIELD_API_BASE` não configurado

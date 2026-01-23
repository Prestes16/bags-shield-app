# Auditoria de Segurança - API Routes

## 🔒 Vulnerabilidades Encontradas e Corrigidas

### ✅ 1. SSRF (Server-Side Request Forgery) - **CRÍTICO** - CORRIGIDO

**Problema:**
- `BAGS_SHIELD_API_BASE` aceitava qualquer URL, permitindo requests para:
  - `localhost`, `127.0.0.1`
  - IPs privados (192.168.x.x, 10.x.x.x)
  - AWS metadata (169.254.169.254)
  - Protocolos perigosos (file://, gopher://)

**Correção:**
- Criado `src/lib/urlValidation.ts` com `validateBackendUrl()`
- Bloqueia protocolos perigosos (file, gopher, ftp, data, javascript, vbscript)
- Bloqueia hosts internos (localhost, 127.0.0.1, IPs privados)
- Bloqueia AWS/GCP metadata endpoints
- Apenas permite http/https
- Validação aplicada em:
  - `src/lib/proxy.ts` → `forwardToBackend()`
  - `src/app/api/scan/route.ts` → antes de usar `baseRaw`
  - `src/lib/solanaRpc.ts` → validação de RPC URL

**Status:** ✅ Corrigido

---

### ✅ 2. CORS Permissivo - **ALTO** - CORRIGIDO

**Problema:**
- CORS permitia qualquer origem (`*`)
- Não validava origem do request

**Correção:**
- Criada função `isValidOrigin()` em `src/lib/proxy.ts`
- Valida protocolo (apenas http/https)
- Bloqueia localhost/IPs privados em produção
- Permite localhost apenas em desenvolvimento
- Retorna `null` ao invés de `*` se origem inválida

**Status:** ✅ Corrigido

---

### ✅ 3. Content-Type Não Validado - **MÉDIO** - CORRIGIDO

**Problema:**
- Aceitava qualquer Content-Type
- Poderia processar HTML/XML como JSON

**Correção:**
- Validação de Content-Type em `src/app/api/scan/route.ts`
- Retorna 400 se não for `application/json`
- Mensagem de erro clara

**Status:** ✅ Corrigido

---

### ✅ 4. Headers de Cache Faltando - **BAIXO** - CORRIGIDO

**Problema:**
- Algumas respostas não tinham `cache-control: no-store`

**Correção:**
- Adicionado `cache-control: no-store, no-cache, must-revalidate` em todas as respostas
- Adicionado `content-type: application/json` explicitamente

**Status:** ✅ Corrigido

---

### ⚠️ 5. Rate Limiting Ausente - **MÉDIO** - RECOMENDAÇÃO

**Problema:**
- Não há rate limiting nas rotas de API
- Permite DoS via requisições simultâneas

**Recomendação:**
- Implementar rate limiting (ex: `@upstash/ratelimit` ou middleware custom)
- Limites sugeridos:
  - `/api/scan`: 10 req/min por IP
  - `/api/simulate`: 20 req/min por IP
  - `/api/apply`: 30 req/min por IP

**Status:** ⚠️ Recomendação (não crítico para MVP)

---

### ✅ 6. Error Information Disclosure - **BAIXO** - CORRIGIDO

**Problema:**
- Erros poderiam expor stack traces ou paths internos

**Correção:**
- Mensagens de erro genéricas
- Não expõe `err.message` diretamente (exceto erros de validação SSRF)
- Remove detalhes de stack traces

**Status:** ✅ Corrigido

---

## 🛡️ Proteções Implementadas

### Validação de Input
- ✅ Mint: Base58, 32-44 chars, sem caracteres ambíguos
- ✅ JSON parsing defensivo com fallback regex
- ✅ Content-Type validation
- ✅ Body size (timeout protege contra bodies muito grandes)

### SSRF Protection
- ✅ Validação de URL antes de fazer fetch
- ✅ Bloqueio de protocolos perigosos
- ✅ Bloqueio de hosts internos/privados
- ✅ Validação de RPC URL (apenas HTTPS para custom, ou domínios conhecidos)

### CORS
- ✅ Validação de origem
- ✅ Echo de origem válida (não `*` sempre)
- ✅ Headers CORS restritos

### Headers de Segurança
- ✅ `cache-control: no-store` em todas as respostas
- ✅ `content-type: application/json` explícito
- ✅ Filtragem de hop-by-hop headers
- ✅ Geração de `x-request-id` único

### Timeouts
- ✅ Backend proxy: 15s
- ✅ Generic proxy: 20s (configurável)
- ✅ Solana RPC: 10s por chamada
- ✅ AbortController para cancelamento

---

## 📋 Checklist de Segurança

- [x] Validação de input (mint Base58)
- [x] SSRF protection (validação de URL)
- [x] CORS restrito (validação de origem)
- [x] Content-Type validation
- [x] Error handling seguro (sem vazamento de info)
- [x] Headers de segurança (cache-control, content-type)
- [x] Timeouts configurados
- [x] Filtragem de headers (hop-by-hop)
- [ ] Rate limiting (recomendado, não crítico)
- [x] HTTPS enforcement para RPC custom
- [x] Validação de protocolos (apenas http/https)

---

## 🧪 Testes de Segurança

Execute `scripts/test-api-security.ps1` para validar:
- Validação de mint inválido
- SSRF protection
- Timeouts
- Headers de segurança
- CORS
- Error disclosure
- Content-Type validation
- Body size limits
- Requisições simultâneas
- Injection attacks

---

## 📝 Notas

1. **Rate Limiting**: Considerar implementar em produção usando Vercel Edge Config ou Upstash
2. **Monitoring**: Adicionar logging de tentativas de SSRF para detecção de ataques
3. **WAF**: Considerar Cloudflare WAF ou similar em produção
4. **HTTPS Only**: Em produção, forçar HTTPS para todas as URLs de backend

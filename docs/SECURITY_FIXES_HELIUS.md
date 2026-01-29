# Security Fixes - Helius Integration

## Brechas Identificadas e Corrigidas

### 1. ✅ Method Injection no heliusRpc
**Problema**: O parâmetro `method` não era validado, permitindo chamadas a métodos RPC arbitrários.

**Correção**: 
- Whitelist de métodos permitidos: `["getAsset", "getAssetBatch", "searchAssets"]`
- Validação antes de construir a requisição

### 2. ✅ Params Injection
**Problema**: Parâmetros RPC não eram sanitizados, permitindo injeção de objetos maliciosos.

**Correção**:
- Validação de tipo e estrutura
- Limite de tamanho (10KB max)
- Verificação de prototype pollution

### 3. ✅ ReDoS (Regular Expression Denial of Service)
**Problema**: Regex base58 sem limite de comprimento permitia strings muito longas causando ReDoS.

**Correção**:
- Regex limitado: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`
- Validação de comprimento antes do regex
- Aplicado em todas as funções de validação base58

### 4. ✅ Memory Exhaustion em Batch
**Problema**: Array de IDs podia ter milhões de elementos antes da validação.

**Correção**:
- Limite de 100 itens antes do processamento
- Limite de 20 itens válidos após filtragem
- Deduplicação de IDs
- Timeout total de 15s para batch completo

### 5. ✅ DoS via Request Body
**Problema**: Sem limite de tamanho do body em `/api/das/batch`.

**Correção**:
- Limite de 50KB para body JSON
- Validação antes do parse
- Retorno 413 (Payload Too Large)

### 6. ✅ Cluster Injection
**Problema**: `HELIUS_CLUSTER` não era validado, permitindo injeção na URL.

**Correção**:
- Whitelist de clusters permitidos
- Sanitização da API key
- Limite de tamanho da API key (200 chars)

### 7. ✅ Timeout Insuficiente
**Problema**: Batch requests sem timeout total, permitindo acúmulo de requisições.

**Correção**:
- Timeout total de 15s para batch
- Timeout individual de 12s por requisição
- AbortController para cancelar requisições pendentes

### 8. ✅ Rate Limiting Ausente
**Problema**: Sem proteção contra abuso de API.

**Correção**:
- Rate limiting por IP
- `/api/das/asset`: 120 req/min
- `/api/das/batch`: 30 req/min
- Retorno 429 (Too Many Requests)

### 9. ✅ Request ID Injection
**Problema**: Request ID do header não era sanitizado.

**Correção**:
- Validação de formato e tamanho
- Sanitização de caracteres permitidos
- Fallback para ID gerado se inválido

### 10. ✅ Prototype Pollution
**Problema**: Objetos JSON não validados podiam ter prototypes maliciosos.

**Correção**:
- Verificação de `Object.getPrototypeOf() === Object.prototype`
- Rejeição de objetos com prototypes customizados

## Proteções Adicionais

### Validação de Inputs
- Todos os inputs são validados antes do processamento
- Type checking rigoroso
- Sanitização de strings

### Timeouts
- Timeout individual: 12s (configurável, max 30s)
- Timeout batch: 15s total
- Timeout RPC: validado entre 1s-30s

### Error Handling
- Erros genéricos (não expõem detalhes internos)
- Logs seguros (sem chaves/credenciais)
- Graceful degradation

### Headers de Segurança
- `Cache-Control: no-store` em todas as respostas
- `X-Request-Id` para rastreamento
- Rate limit headers (futuro)

## Recomendações Futuras

1. **Redis para Rate Limiting**: Substituir store in-memory por Redis em produção
2. **WAF**: Adicionar Web Application Firewall na Vercel
3. **Monitoring**: Alertas para padrões suspeitos
4. **Audit Logs**: Registrar tentativas de abuso
5. **API Key Rotation**: Suporte para rotação de chaves Helius

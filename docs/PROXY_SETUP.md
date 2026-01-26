# Proxy Setup

## Configuração

Defina `BAGS_SHIELD_API_BASE` no `.env.local`:

```bash
BAGS_SHIELD_API_BASE=https://bags-shield-api.vercel.app
```

## Testes

Teste as rotas de proxy:

```bash
# Scan
curl http://localhost:3000/api/scan

# Simulate
curl http://localhost:3000/api/simulate

# Apply
curl http://localhost:3000/api/apply

# Launchpad Ping
curl http://localhost:3000/api/launchpad/ping
```

## Comportamento

- **Com `BAGS_SHIELD_API_BASE` configurado**: Rotas fazem proxy para o backend real
- **Sem `BAGS_SHIELD_API_BASE`**: Retorna `501` com JSON `{success: false, error: "MISSING_BAGS_SHIELD_API_BASE"}`

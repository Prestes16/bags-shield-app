# Bags Shield — UI Screen Map (fonte de verdade)

## Regras rápidas
- NUNCA regenerar/“simplificar” telas existentes. Só mover/renomear e ajustar imports.
- Estilo base: dark navy + glow cyan/blue + glassmorphism.
- Ícone: usar SOMENTE `public/images/bags-shield-icon.png` (fiel ao original). Sem emoji em produção.

## Estrutura padrão
- `src/components/screens/*Screen.tsx`  -> telas completas (UI principal)
- `src/components/scan/*`              -> peças do fluxo de scan (input, radar, cards)
- `src/components/states/*`            -> skeleton/empty/loading/erro/toast
- `src/components/shared/*`            -> peças reutilizáveis (header, bottom-nav, badges)
- `src/app/**/page.tsx`                -> rotas (wrappers, sem UI pesada)

## Rotas (App Router)
01) `/`                       -> Home/Dashboard (shell + navegação)
02) `/scan`                   -> Scan (input + CTA)
03) `/scan/loading`           -> Scan Loading (radar + steps)
04) `/scan/result/[mint]`     -> Scan Result (resultado + ações: simulate/apply/share)
05) `/simulate`               -> Simulate (form/params)
06) `/simulate/result`        -> Simulate Result (resultado + warnings)
07) `/apply`                  -> Apply (confirmações/fee)
08) `/watchlist`              -> Watchlist (lista + alertas + navegar pro scan)
09) `/alerts`                 -> Alerts (Tela 16: regras/thresholds/cooldown UI)
10) `/history`                -> History (scans recentes)
11) `/settings`               -> Settings (tema, idioma, debug)

## Componentes “âncora” que não podem virar genérico
- Scan loading radar (efeito rings + steps + progress)
- Watchlist (glass cards + glow por score + bell animado)
- SkeletonResult (dark-glass skeleton)
- EmptyWatchlist (empty state premium)
- LoadingOverlay / Toast (feedback curto e bonito)

## Integração de API (depois, no Cursor)
- Usar proxy routes em `src/app/api/*/route.ts` (scan/simulate/apply)
- UI chama SEMPRE `/api/...` (e nunca URL hardcoded do upstream)
- Headers: no-store, timeout, tratamento 429 com cooldown

# UI LOCK — Bags Shield App

## Regra de Ouro

**NÃO modificar UI/estética/layout/strings/cores/spacing.**

**NÃO refatorar componentes visuais "porque sim".**

**NÃO trocar libs de UI, Next, React, Tailwind.**

## Você SÓ pode mexer em:

- ✅ `src/lib/**` (fetchers, clients, validação, tipos)
- ✅ `src/app/api/**` (route handlers: /api/scan, /api/simulate, /api/apply, wallet session etc.)
- ✅ `src/lib/wallet.ts` (integração wallet), mas **sem alterar UI**
- ✅ Tipos e validações necessárias para dados reais

## ZONA A — UI (INTOCÁVEL / BASELINE V0):

- ❌ `src/app/**` (páginas e layout) — **NÃO MEXER**
- ❌ `src/components/**` (componentes visuais) — **NÃO MEXER**
- ❌ `globals.css`, tema, tokens — **NÃO MEXER**
- ❌ `tailwind.config.ts` — **NÃO MEXER**

## ZONA B — Motor (Cursor pode mexer):

- ✅ `src/lib/**` (lógica, integrações, validações)
- ✅ `src/app/api/**` (API routes, proxies)
- ✅ `.env.local` (configurações de ambiente)

## Objetivo:

- Ligar dados reais (scan/simulate/apply + wallet) **SEM mexer na cara do v0**.
- Build precisa passar: `npm run build`
- Testes manuais: POST /api/scan com mint válido.

## Se precisar mudar UI:

**Abra uma tarefa separada e pare.** Não faça mudanças de UI junto com mudanças de integração.

---

**Isso já reduz MUITO a chance do Cursor "embelezar" e destruir a UI que você curtiu.**

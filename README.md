This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Troubleshooting Dev Server

If you see errors like `Cannot find module './XXX.js'` or 404s on `/_next/static/*`:

1. Stop the dev server (Ctrl+C)
2. Run: `.\scripts\dev-clean.ps1`
3. Restart: `npm run dev`

This cleans the Next.js cache which may be corrupted.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Roadmap (Now / Next / Later)

### Now (Core → produção)
- Stable Scan output (Risk Badges + ShieldScore) with clear "why" explanations
- Helius integration to enrich token data (metadata/holders/tx context)
- Sellability / Restriction Test (v1): PASS / FAIL / UNKNOWN with evidence-based rules
- i18n: pt-BR / EN

### Next (Premium monitoring)
- Watchlist Alerts via Helius Webhooks (in-app alerts first, push later)
- Critical triggers: whale dumps (>% supply), risk changes, suspicious activity patterns

### Later (Deep risk intelligence + Verified launch)
- Insider Clusters (v1: common funder 1-hop for Top holders; v2: deeper heuristics + anti-CEX noise)
- Bags Verified: creator checklist + on-chain proofs + SIWS claim flow
- Verified Launchpad: transparency requirements + score boost + public criteria

## Planned Integrations

### ✅ Helius DAS API
- **Status**: Implemented
- **Features**: Token metadata enrichment, batch asset queries, DAS as default metadata source
- **Endpoints**: `/api/das/asset`, `/api/das/batch`
- **Docs**: See [docs/env.md](./docs/env.md) for `HELIUS_API_KEY` configuration

### 🔄 Bags Shield API
- **Status**: Integration in progress
- **Features**: Scan proxy, risk scoring, shield verification
- **Endpoints**: `/api/scan`, `/api/simulate`

### ✅ Jupiter Aggregator
- **Status**: Implemented (behind feature flag)
- **Features**: Quote and swap transactions via Jupiter API
- **Endpoints**: `/api/jupiter/quote`, `/api/jupiter/swap`
- **Docs**: See [docs/env.md](./docs/env.md) for configuration

### ✅ Monetization (Transparent)
- **Status**: Implemented (behind feature flags, OFF by default)
- **Features**:
  - **Pro Scan**: Optional paid scans with on-chain verification
  - **Jupiter Platform Fee**: Transparent fee on swaps (default 0.40%, configurable)
- **Wallets**:
  - **OPS**: `3Lwdox6RdkA8BDyxoVNUuvEDGn3rH5f51CzYVujcKxjB` (infrastructure/maintenance)
  - **Treasury**: `CEHQL165RAytE3afmWfndkPuKCqBxcMRgZkiEC4tVriq` (app/community/future)
- **Note**: V1 uses OPS wallet only for Jupiter fees. Treasury split is operational (off-chain). Network fees are separate.
- **Docs**: See [docs/env.md](./docs/env.md) for configuration

### ✅ Solana RPC
- **Status**: Implemented
- **Features**: On-chain data fallback, transaction verification, mint account queries
- **Configuration**: 
  - `SOLANA_RPC_URL` (server-side, preferred)
  - `NEXT_PUBLIC_SOLANA_RPC_URL` (client-side only)
- **Endpoints**: `/api/rpc/status` (diagnostic)
- **Docs**: See [docs/env.md](./docs/env.md) for configuration

### 📋 Additional Integrations (Future)
- Webhook services for real-time monitoring
- Analytics and tracking services

---

## Monetization (Transparent)

Bags Shield App includes optional monetization features, all behind feature flags and **OFF by default**:

### Pro Scan (Paid Scans)
- **Status**: Optional, disabled by default
- **How it works**: Users can opt-in to Pro Scan for enhanced analysis
- **Payment**: Small fee in SOL (default 0.0001 SOL, configurable)
- **Verification**: On-chain transaction verification ensures payment
- **Transparency**: All fees are clearly displayed before payment

### Jupiter Platform Fee
- **Status**: Optional, disabled by default
- **Default rate**: 0.40% (40 basis points, configurable 0-2%)
- **How it works**: Applied transparently to Jupiter swaps
- **Split**: V1 uses OPS wallet only. Treasury split is operational (off-chain).
- **Note**: Network fees (Solana transaction fees) are separate and paid directly to the network

### Wallets
- **OPS Wallet**: `3Lwdox6RdkA8BDyxoVNUuvEDGn3rH5f51CzYVujcKxjB`
  - Infrastructure and maintenance costs
  - Jupiter platform fees (v1)
  - Pro Scan payments
- **Treasury Wallet**: `CEHQL165RAytE3afmWfndkPuKCqBxcMRgZkiEC4tVriq`
  - App development and community initiatives
  - Documented for transparency
  - V1 split is operational (not on-chain)

### Configuration
See [docs/env.md](./docs/env.md) for all environment variables and configuration options.

**Important**: All monetization features default to **OFF**. You must explicitly enable them via environment variables.

# Environment Variables

This document describes all environment variables used by Bags Shield App.

## Core Configuration

### `NODE_ENV`
- **Type**: `string`
- **Values**: `development` | `production`
- **Default**: `production`
- **Description**: Node.js environment mode

### Troubleshooting Dev Server

Se aparecer erros como `Cannot find module './XXX.js'` ou 404 em `/_next/static/*` no dev server:

1. Pare o dev server (Ctrl+C)
2. Execute: `.\scripts\dev-clean.ps1`
3. Reinicie: `npm run dev`

Isso limpa o cache do Next.js que pode estar corrompido.

### `SOLANA_RPC_URL`
- **Type**: `string` (URL)
- **Default**: `https://api.mainnet-beta.solana.com` (fallback only, not set in env)
- **Description**: Solana RPC endpoint for server-side operations (on-chain queries, transaction verification)
- **Security**: Server-side only (preferred over NEXT_PUBLIC_SOLANA_RPC_URL)
- **Note**: 
  - Used by `/api/scan` fallback, `/api/pro/verify`, and other server-side RPC calls
  - If not set, falls back to `NEXT_PUBLIC_SOLANA_RPC_URL` or default public RPC
  - Check `/api/rpc/status` to verify configuration and connectivity
  - `configured=false` means the env var is not set (using fallback)

### `NEXT_PUBLIC_SOLANA_RPC_URL`
- **Type**: `string` (URL)
- **Default**: `https://api.mainnet-beta.solana.com` (fallback only, not set in env)
- **Description**: Solana RPC endpoint for client-side operations (UI only)
- **Note**: 
  - Only used by client-side code. Server-side code prefers `SOLANA_RPC_URL`.
  - If neither `SOLANA_RPC_URL` nor `NEXT_PUBLIC_SOLANA_RPC_URL` is set, both server and client use the default public RPC
  - Check `/api/rpc/status` to verify server-side RPC configuration

---

## Feature Flags

### `HELIUS_ENABLED`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable Helius DAS API integration for token metadata enrichment

### `RPC_FALLBACK_ENABLED`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable RPC fallback when backend is unreachable

### `LOCAL_CACHE_ENABLED`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable local caching (frontend localStorage + backend in-memory)

### `JUPITER_SWAP_ENABLED`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable Jupiter swap integration (quote + swap)

### `WALLET_CONNECT_ENABLED`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable wallet connection (Phantom, Solflare, Backpack, MWA)

---

## Helius Integration

### `HELIUS_API_KEY`
- **Type**: `string`
- **Required**: Yes (if `HELIUS_ENABLED=true`)
- **Description**: Helius API key for DAS (Digital Asset Standard) queries
- **Security**: Server-side only (never exposed to client)
- **Note**: Get your API key from [Helius Dashboard](https://dashboard.helius.dev)
- **Example**: `your-helius-api-key-here` (do not share or commit to version control)

### `HELIUS_CLUSTER`
- **Type**: `string`
- **Default**: `mainnet`
- **Values**: `devnet` | `mainnet` | `mainnet-beta`
- **Description**: Solana cluster for Helius DAS API
- **Note**: `mainnet-beta` is normalized to `mainnet` internally

---

## App Fees (Optional)

### `APP_FEE_ENABLED`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable platform fees on Jupiter swaps

### `APP_FEE_BPS`
- **Type**: `number` (integer)
- **Default**: `40`
- **Range**: `0-200` (0% to 2%)
- **Description**: Platform fee in basis points (40 = 0.40%)

### `APP_FEE_WALLET_OPS`
- **Type**: `string` (base58 public key, 32-44 chars)
- **Default**: `null`
- **Example**: `3Lwdox6RdkA8BDyxoVNUuvEDGn3rH5f51CzYVujcKxjB`
- **Description**: OPS wallet for infrastructure/maintenance costs
- **Validation**: Must be valid base58, 32-44 characters. If invalid/placeholder, `APP_FEE_ENABLED` is forced to `false` (fail-closed).
- **Note**: V1 uses OPS wallet only for Jupiter fees. Treasury split is operational (off-chain).

### `APP_FEE_WALLET_TREASURY`
- **Type**: `string` (base58 public key, 32-44 chars)
- **Default**: `null`
- **Example**: `CEHQL165RAytE3afmWfndkPuKCqBxcMRgZkiEC4tVriq`
- **Description**: Treasury wallet for app/community/future development
- **Validation**: Must be valid base58, 32-44 characters. Invalid values are ignored.
- **Note**: Documented for transparency. V1 split is operational (not on-chain).

### `APP_FEE_PREFER_MINT`
- **Type**: `string` (base58 mint address)
- **Default**: `So11111111111111111111111111111111111111112` (wSOL)
- **Description**: Preferred mint for fee collection (wSOL)

### `APP_FEE_FALLBACK_MINT`
- **Type**: `string` (base58 mint address)
- **Default**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (USDC)
- **Description**: Fallback mint for fee collection if prefer mint is not in swap pair

---

## Pro Scan (Paid Scans)

### `PRO_SCAN_ENABLED`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable Pro Scan (paid scan option)

### `PRO_SCAN_LAMPORTS`
- **Type**: `number` (integer, lamports)
- **Default**: `100000` (0.0001 SOL)
- **Range**: `0-2000000` (0 to 0.002 SOL)
- **Description**: Payment amount in lamports for Pro Scan

### `PRO_SCAN_VERIFY_ENABLED`
- **Type**: `boolean`
- **Default**: `true` (when `PRO_SCAN_ENABLED=true`)
- **Description**: Enable on-chain verification of Pro Scan payments
- **Note**: If disabled, Pro Scan will not be accessible (fail-closed)

---

## Backend API

### `BAGS_SHIELD_API_BASE`
- **Type**: `string` (URL)
- **Default**: `""`
- **Description**: Base URL for Bags Shield backend API
- **Note**: Can be overridden via query param `?base=...`

### `NEXT_PUBLIC_BAGS_SHIELD_API_BASE`
- **Type**: `string` (URL)
- **Default**: `""`
- **Description**: Public base URL (exposed to client)

---

## Jupiter Aggregator

### `JUPITER_API_URL`
- **Type**: `string` (URL)
- **Default**: `https://api.jup.ag (Swap API v1)`
- **Description**: Jupiter API base URL

### `JUPITER_API_BASE`
- **Type**: `string` (URL)
- **Default**: `https://api.jup.ag (Swap API v1)`
- **Description**: Public Jupiter API URL (if different from server-side)

---

## Webacy Integration (Data Driven / DD)

### `WEBACY_ENABLED`
- **Type**: `boolean`
- **Default**: `false`
- **Values**: `0` | `1` | `false` | `true`
- **Description**: Enable Webacy Data Driven API integration
- **Note**: When disabled (`WEBACY_ENABLED=0`), endpoints return HTTP 412 with error message

### `WEBACY_API_KEY`
- **Type**: `string`
- **Required**: Yes (if `WEBACY_ENABLED=true`)
- **Description**: Webacy API key for Data Driven endpoints
- **Security**: Server-side only (never exposed to client)
- **Note**: Get your API key from [Webacy Dashboard](https://webacy.com)
- **Example**: `your-webacy-api-key-here` (do not share or commit to version control)

### `WEBACY_BASE_URL`
- **Type**: `string` (URL)
- **Default**: `https://api.webacy.com`
- **Description**: Webacy API base URL
- **Note**: Usually not needed to change (default is correct)

### `WEBACY_TIMEOUT_MS`
- **Type**: `number` (integer, milliseconds)
- **Default**: `10000` (10 seconds)
- **Description**: Request timeout for Webacy API calls
- **Note**: Prevents hanging requests

### `WEBACY_CACHE_TTL_MS`
- **Type**: `number` (integer, milliseconds)
- **Default**: `300000` (5 minutes)
- **Description**: Time-to-live for in-memory cache of Webacy responses
- **Note**: Reduces API calls for repeated requests

---

## Example `.env.local`

```bash
# Feature Flags
HELIUS_ENABLED=true
RPC_FALLBACK_ENABLED=true
LOCAL_CACHE_ENABLED=true
JUPITER_SWAP_ENABLED=false
WALLET_CONNECT_ENABLED=true

# Helius
HELIUS_API_KEY=your_helius_api_key_here

# App Fees (Optional - OFF by default)
APP_FEE_ENABLED=false
APP_FEE_BPS=40
APP_FEE_WALLET_OPS=3Lwdox6RdkA8BDyxoVNUuvEDGn3rH5f51CzYVujcKxjB
APP_FEE_WALLET_TREASURY=CEHQL165RAytE3afmWfndkPuKCqBxcMRgZkiEC4tVriq

# Pro Scan (Optional - OFF by default)
PRO_SCAN_ENABLED=false
PRO_SCAN_LAMPORTS=100000
PRO_SCAN_VERIFY_ENABLED=true

# RPC
SOLANA_RPC_URL=https://solana.publicnode.com
NEXT_PUBLIC_SOLANA_RPC_URL=https://solana.publicnode.com

# Webacy (Optional - OFF by default)
WEBACY_ENABLED=0
WEBACY_API_KEY=your_webacy_api_key_here
WEBACY_BASE_URL=https://api.webacy.com
```

---

## Security Notes

- Never commit `.env.local` or `.env.production.local` to version control
- Server-side variables (without `NEXT_PUBLIC_` prefix) are never exposed to the client
- All feature flags default to safe values (fail-closed)
- Payment verification is enabled by default when Pro Scan is enabled

---

## See Also

- [README.md](../README.md) - Project overview and setup
- [docs/fees.md](./fees.md) - Detailed fee documentation (if exists)

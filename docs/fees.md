# App Fees Documentation

## Overview

Bags Shield App includes optional monetization features to support infrastructure costs and future development. All fees are **transparent** and **opt-in**.

---

## Fee Types

### 1. Jupiter Platform Fee

**What**: Small percentage fee on Jupiter swaps  
**Default**: 0.40% (40 basis points, configurable 0-2%)  
**Wallet**: OPS wallet (v1)  
**When**: Applied only when `APP_FEE_ENABLED=true` and swap pair includes fee mint (wSOL or USDC)

**How it works**:
- Fee is calculated by Jupiter based on `platformFeeBps`
- Fee is deducted from swap output
- Fee goes to OPS wallet (infrastructure/maintenance)
- Network fees (Solana transaction fees) are separate

**Transparency**:
- Shown in UI before swap: "App Fee: 0.40%"
- Tooltip explains: "Used to keep the service alive (infra + security). Network fees are separate."

### 2. Pro Scan Fee

**What**: Optional paid scan with enhanced analysis  
**Default**: 0.0001 SOL (100,000 lamports, configurable)  
**Wallet**: OPS wallet  
**When**: Applied only when `PRO_SCAN_ENABLED=true` and user opts in

**How it works**:
- User toggles "Pro Scan" option
- User pays via wallet (SystemProgram transfer)
- Payment is verified on-chain before scan
- Scan proceeds with enhanced features (Helius if enabled)

**Transparency**:
- Price shown in UI: "0.000100 SOL"
- Payment destination shown before payment
- Verification status shown after payment

---

## Wallets

### OPS Wallet
- **Address**: `3Lwdox6RdkA8BDyxoVNUuvEDGn3rH5f51CzYVujcKxjB`
- **Purpose**: Infrastructure and maintenance costs
- **Receives**: Jupiter platform fees (v1), Pro Scan payments

### Treasury Wallet
- **Address**: `CEHQL165RAytE3afmWfndkPuKCqBxcMRgZkiEC4tVriq`
- **Purpose**: App development and community initiatives
- **Note**: V1 split is operational (off-chain), not on-chain

---

## Configuration

See [env.md](./env.md) for all environment variables.

**Important**: All fees default to **OFF**. You must explicitly enable them.

---

## Fee Calculation

### Jupiter Platform Fee

```
fee = (swapAmount * platformFeeBps) / 10000
```

Example: 1 SOL swap with 40 bps fee = 0.004 SOL fee

### Pro Scan Fee

Fixed amount in lamports (default: 100,000 = 0.0001 SOL)

---

## Transparency

All fees are:
- ✅ Clearly displayed before user confirms
- ✅ Separated from network fees
- ✅ Documented publicly
- ✅ Optional (user can choose not to use)

---

## V1 Limitations

- Jupiter fee uses OPS wallet only (Treasury split is operational)
- Pro Scan payment requires manual wallet transaction (future: automated)
- Fee mint must be in swap pair (wSOL or USDC)

---

## Future Improvements (V2)

- Automatic Treasury split on-chain
- Automated Pro Scan payment flow
- Fee breakdown in UI (network vs platform)
- Payment history

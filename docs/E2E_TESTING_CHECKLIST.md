# E2E Testing Checklist - Mobile & Web

## Overview
This checklist covers end-to-end testing for Bags Shield App on mobile (Solana Mobile/Seeker) and web browsers.

## Prerequisites
- [ ] App deployed or running locally
- [ ] Test wallets installed and configured
- [ ] Test SOL/tokens available in test wallets
- [ ] Network connectivity verified

## Test Wallets
- [ ] Phantom (Web & Mobile)
- [ ] Solflare (Web & Mobile)
- [ ] Backpack (Web)
- [ ] Solana Mobile Seed Vault (MWA - Mobile only)

---

## Core Path Tests

### 1. Health & Features
- [ ] `/api/health` returns 200 OK
- [ ] `/api/features` returns feature flags
- [ ] Feature flags match environment configuration

### 2. Wallet Detection & Connection

#### Web Browsers
- [ ] Phantom wallet detected when installed
- [ ] Solflare wallet detected when installed
- [ ] Backpack wallet detected when installed
- [ ] "No wallet detected" message shown when no wallet installed
- [ ] Wallet connection successful
- [ ] Public key displayed after connection
- [ ] Disconnect works correctly

#### Mobile (Solana Mobile/Seeker)
- [ ] MWA (Mobile Wallet Adapter) detected
- [ ] Seed Vault connection works
- [ ] Native signing flows work
- [ ] Transaction signing works via MWA

### 3. Scan Flow

#### Basic Scan
- [ ] Enter valid token mint address
- [ ] Scan completes successfully
- [ ] Results displayed (score, grade, findings)
- [ ] Token metadata displayed (name, symbol, image)
- [ ] Cache status badge shown when using cached data
- [ ] "Degraded mode" badge shown when using RPC fallback

#### Error Cases
- [ ] Invalid mint address shows error
- [ ] Empty input shows validation error
- [ ] Network error handled gracefully
- [ ] Backend unavailable falls back to RPC (if enabled)

#### Cache Behavior
- [ ] First scan fetches from API
- [ ] Second scan (same mint) uses cache
- [ ] Cache expires after TTL
- [ ] Stale-while-revalidate works (shows cached, refreshes in background)

### 4. Jupiter Swap (if enabled)

#### Quote Flow
- [ ] Get quote button works
- [ ] Quote shows expected output amount
- [ ] Minimum output calculated with slippage
- [ ] Price impact displayed
- [ ] Slippage settings work (0.1%, 0.5%, 1%, 5%)

#### Swap Flow
- [ ] Wallet connected before swap
- [ ] Transaction signing prompt appears
- [ ] User can approve transaction
- [ ] User can reject transaction (error handled)
- [ ] Transaction status updates (pending → success/fail)
- [ ] Explorer link works (Solscan)
- [ ] Success message displayed

#### Error Cases
- [ ] Swap fails if wallet not connected
- [ ] Swap fails if quote expired
- [ ] Network errors handled gracefully
- [ ] Insufficient balance error shown

---

## Mobile-Specific Tests (Solana Mobile/Seeker)

### Device Detection
- [ ] App detects Solana Mobile device
- [ ] MWA adapter available
- [ ] Native wallet integration works

### Native Flows
- [ ] Seed Vault connection via native intent
- [ ] Transaction signing via native intent
- [ ] Message signing via native intent
- [ ] Deep linking works (if implemented)

### Performance
- [ ] App loads quickly on mobile
- [ ] Scan completes within reasonable time (< 5s)
- [ ] Cache improves subsequent load times
- [ ] No memory leaks during extended use

---

## Browser-Specific Tests

### Desktop Browsers
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if applicable)

### Mobile Browsers
- [ ] Chrome Mobile
- [ ] Safari Mobile
- [ ] Solana Mobile Browser (Seeker)

---

## Feature Flag Tests

### HELIUS_ENABLED
- [ ] When enabled: DAS metadata fetched
- [ ] When disabled: Falls back to on-chain

### RPC_FALLBACK_ENABLED
- [ ] When enabled: RPC fallback works when backend down
- [ ] When disabled: Error shown when backend down

### LOCAL_CACHE_ENABLED
- [ ] When enabled: Cache works
- [ ] When disabled: No cache, always fresh fetch

### JUPITER_SWAP_ENABLED
- [ ] When enabled: Buy/Sell buttons visible
- [ ] When disabled: Buy/Sell buttons hidden

### WALLET_CONNECT_ENABLED
- [ ] When enabled: Wallet connection works
- [ ] When disabled: Connection blocked with message

---

## Security Tests

### Input Validation
- [ ] XSS attempts blocked
- [ ] SQL injection attempts blocked (if applicable)
- [ ] SSRF attempts blocked
- [ ] Invalid mint addresses rejected

### Wallet Security
- [ ] Private keys never stored
- [ ] Transactions only signed by wallet
- [ ] No auto-approval of transactions
- [ ] Slippage settings visible before approval

---

## Performance Tests

### Load Times
- [ ] Initial page load < 2s
- [ ] Scan completes < 5s (first time)
- [ ] Cached scan < 500ms
- [ ] Quote fetch < 3s

### Resource Usage
- [ ] No excessive API calls
- [ ] Cache reduces redundant requests
- [ ] Memory usage reasonable

---

## Accessibility Tests

### Mobile
- [ ] Touch targets large enough (min 44x44px)
- [ ] Text readable without zoom
- [ ] Colors have sufficient contrast
- [ ] Screen reader compatible (if applicable)

### Web
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] ARIA labels present (if applicable)

---

## Notes

### Known Issues
- Document any known issues or limitations here

### Test Environment
- **Date:** ___________
- **Tester:** ___________
- **Environment:** [ ] Local [ ] Staging [ ] Production
- **Network:** [ ] WiFi [ ] Mobile Data [ ] Offline

### Results Summary
- **Total Tests:** ___________
- **Passed:** ___________
- **Failed:** ___________
- **Blocked:** ___________

---

## Quick Test Script

Run smoke tests:
```powershell
.\scripts\smoke.ps1 -BaseUrl "http://localhost:3000" -Verbose
```

Test production:
```powershell
.\scripts\smoke.ps1 -BaseUrl "https://your-production-url.com" -Verbose
```

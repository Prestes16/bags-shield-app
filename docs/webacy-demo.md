# Webacy Integration - Demo Mode Strategy

## Overview

This document describes the "demo mode" strategy for integrating Webacy Data Driven (DD) API into Bags Shield App. The goal is to minimize API credit usage while providing a smooth user experience.

---

## Strategy

### 1. **Server-Side Caching**

- **Cache TTL**: Configurable via `WEBACY_CACHE_TTL_MS` (default: 5 minutes, recommended: 15 minutes for demos)
- **Cache Key**: Includes endpoint, chain, and mint address: `webacy:{endpoint}:{chain}:{mint}`
- **Cache Size Limit**: 100 entries (LRU eviction)
- **Cache Scope**: Per-instance (serverless functions) - acceptable for demo purposes

**Benefits:**
- Repeated scans of the same mint reuse cached data
- Reduces API credit consumption significantly
- Fast response times for cached requests

### 2. **UI Lazy Loading**

#### Trading Lite (Auto-load)
- **When**: Automatically loaded once per mint scan (when scan result page loads)
- **Frequency**: Only once per mint per cache TTL period
- **UI**: Collapsed panel with "Expand" button
- **Display**: Shows summary data, indicates if cached

#### Holder Analysis (On-Demand)
- **When**: Only loaded when user clicks "Load Holder Analysis" button
- **Frequency**: Once per user interaction (also cached server-side)
- **UI**: Button in collapsed panel, expands when loaded
- **Display**: Shows analysis data, indicates if cached

**Benefits:**
- Trading Lite provides immediate value without user action
- Holder Analysis only consumed when user explicitly requests it
- Reduces unnecessary API calls

### 3. **Debounce and Avoid Auto-Refresh**

- **No Auto-Refresh**: Webacy data does not auto-refresh on page reload
- **Manual Refresh**: User must navigate away and back to trigger new fetch (respects cache TTL)
- **Debounce**: Client-side debounce prevents rapid successive clicks

**Benefits:**
- Prevents accidental API credit consumption
- Respects cache TTL naturally
- User controls when to fetch fresh data

---

## Environment Variables

### Required (for enabled mode)

```env
WEBACY_ENABLED=1
WEBACY_API_KEY=your_api_key_here
WEBACY_BASE_URL=https://api.webacy.com
```

### Optional

```env
# Timeout for API requests (default: 10000ms = 10s)
WEBACY_TIMEOUT_MS=10000

# Cache TTL in milliseconds (default: 300000ms = 5min)
# Recommended for demos: 900000ms = 15min
WEBACY_CACHE_TTL_MS=900000
```

### Disabled Mode

```env
WEBACY_ENABLED=0
```

When disabled:
- Endpoints return HTTP 412 (Precondition Failed)
- UI component silently hides (no error shown to user)
- No API credits consumed

---

## API Endpoints

### `GET /api/dd/trading-lite?mint=<base58>&chain=sol`

**Purpose**: Get trading signals for a token

**Parameters**:
- `mint` (required): Base58 mint address (32-44 chars)
- `chain` (optional): Chain identifier (default: "sol")

**Response**:
```json
{
  "success": true,
  "response": {
    "tradingLite": { /* Webacy trading data */ }
  },
  "meta": {
    "cached": false,
    "provider": "webacy"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Error message from upstream",
  "meta": {
    "provider": "webacy",
    "upstreamStatus": 400,
    "cached": false
  }
}
```

### `GET /api/dd/holder-analysis?mint=<base58>&chain=sol`

**Purpose**: Get holder analysis for a token

**Parameters**: Same as trading-lite

**Response**: Same structure as trading-lite, with `holderAnalysis` instead of `tradingLite`

**Premium/Locked Response** (when Webacy returns 402/403):
```json
{
  "success": true,
  "response": {
    "holderAnalysis": null,
    "available": false
  },
  "meta": {
    "provider": "webacy",
    "restricted": true,
    "reason": "premium",
    "upstreamStatus": 403,
    "cached": false
  }
}
```

**Note**: Holder Analysis is a **Premium feature**. Demo API keys typically return 403. Our app transforms this into HTTP 200 with `restricted: true` to avoid breaking the UI. The feature is shown as "Premium/Locked" in the UI.

---

## Rate Limiting

- **Limit**: 60 requests per minute per IP
- **Scope**: Per endpoint (trading-lite and holder-analysis have separate limits)
- **Implementation**: In-memory (per-instance in serverless)

**Rate Limit Response**:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait a moment before trying again.",
  "meta": {
    "requestId": "...",
    "retryAfter": 30
  }
}
```

---

## Error Handling

### Controlled Errors (Never Generic 500)

All errors return structured JSON with:
- `success: false`
- `error`: Human-readable message from upstream or controlled message
- `meta.upstreamStatus`: HTTP status from Webacy API (if applicable)
- `meta.cached`: Always `false` for errors

### Error Status Codes

- **412**: Webacy integration disabled (`WEBACY_ENABLED=0`)
- **503**: Webacy API key not configured (`WEBACY_API_KEY` missing)
- **400**: Invalid mint address or unsupported chain
- **429**: Rate limit exceeded
- **502**: Network error or invalid response from Webacy API
- **500**: Internal error (only in development, includes debug info)

### Premium/Locked Status (402/403)

- **402/403**: Premium feature not available (Holder Analysis)
  - **Backend**: Transformed to HTTP 200 with `success: true` and `meta.restricted: true`
  - **Cache**: Negative cache for 30 minutes to avoid repeated API calls
  - **UI**: Shown as "Premium Feature - not available in demo" (elegant, not an error)
  - **Smoke Test**: Accepted as PASS (LOCKED/Premium)

### Development vs Production

**Development** (`NODE_ENV=development`):
- Error responses include `meta.requestId` and `meta.debug`
- More detailed error messages

**Production**:
- Error responses exclude debug information
- Generic error messages for internal errors
- Never expose secrets or stack traces

---

## UI Component Behavior

### WebacySignals Component

**Location**: `src/components/webacy/WebacySignals.tsx`

**Behavior**:
1. **Auto-load Trading Lite**: Fetches on mount (once per mint scan)
2. **Silent Hide**: Hides if Webacy disabled/not configured (no error shown)
3. **Error Handling**: Hides on error (user doesn't need to see Webacy errors)
4. **Cache Indicator**: Shows "(cached)" badge when data is from cache
5. **Lazy Load Holder Analysis**: Only loads when button clicked
6. **Collapsible**: Panel can be expanded/collapsed

**Integration**: Added to scan result page (`src/app/scan/result/[mint]/page.tsx`)

---

## Credit Usage Optimization

### Best Practices

1. **Set Appropriate Cache TTL**: 
   - Demo: 15 minutes (`WEBACY_CACHE_TTL_MS=900000`)
   - Production: 5 minutes (`WEBACY_CACHE_TTL_MS=300000`)

2. **Monitor Cache Hit Rate**:
   - Check `meta.cached` in responses
   - Higher cache hit rate = lower credit usage

3. **Use Holder Analysis Sparingly**:
   - Only load when user explicitly requests it
   - Already cached server-side, so repeated clicks don't consume credits
   - **Negative Cache**: 403/402 responses are cached for 30 minutes to avoid repeated API calls

4. **Disable When Not Needed**:
   - Set `WEBACY_ENABLED=0` to disable completely
   - UI silently hides, no errors shown

### Premium Features (Holder Analysis)

- **Demo Keys**: Typically return 403 (Premium feature)
- **Negative Cache**: 30-minute cache prevents repeated 403 calls
- **UI Behavior**: Shows as "Premium Feature" (elegant, not an error)
- **Credit Savings**: Negative cache reduces API calls by ~95% for premium endpoints

---

## Testing

### Smoke Test Script

**Location**: `scripts/smoke-webacy.ps1`

**Usage**:
```powershell
# Test local development
.\scripts\smoke-webacy.ps1 -BaseUrl "http://localhost:3000"

# Test production
.\scripts\smoke-webacy.ps1 -BaseUrl "https://bags-shield-api.vercel.app" -Mint "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

**Test Scenarios**:
1. Trading Lite (first call - should not be cached)
2. Trading Lite (second call - should be cached if TTL > 0)
3. Holder Analysis
4. Missing mint (should return 400)
5. Invalid mint (should return 400)

**Expected Results**:
- First call: `meta.cached: false`
- Second call (within TTL): `meta.cached: true`
- Status codes: 200 for success, 412/503 for disabled/not configured, 400 for invalid input
- Holder Analysis: May return `success: true` with `meta.restricted: true` (LOCKED/Premium) - this is PASS

---

## Security

### Secrets Protection

- **API Key**: Never exposed to client (server-side only)
- **Logging**: Secrets redacted in logs (via `safeLog`)
- **Error Messages**: Never include API key or sensitive data

### SSRF Protection

- **URL Validation**: Base URL validated before use
- **Redirect Prevention**: `redirect: "manual"` in fetch options
- **Origin Check**: Final URL must match base URL origin

### Input Validation

- **Mint Validation**: Base58, 32-44 chars
- **Chain Validation**: Only "sol" supported (defaults to "sol")
- **Query Params**: Sanitized before use

---

## Monitoring

### Recommended Metrics

1. **Cache Hit Rate**: Percentage of requests served from cache
2. **API Error Rate**: Percentage of requests that fail
3. **Average Response Time**: Including cached vs non-cached
4. **Credit Usage**: Track API calls per day/hour

### Logging

- **Server-side**: Use `safeLog` for all logging (redacts secrets)
- **Client-side**: Console logs for debugging (development only)
- **Request IDs**: Included in all responses for tracing

---

## Troubleshooting

### Common Issues

1. **"chain is not defined" Error**:
   - **Fixed**: Chain parameter now properly passed through function calls
   - **Solution**: Ensure chain defaults to "sol" when not provided

2. **Generic "Internal server error"**:
   - **Fixed**: All errors now return controlled JSON responses
   - **Solution**: Check `meta.upstreamStatus` for actual error code

3. **Cache Not Working**:
   - **Check**: `WEBACY_CACHE_TTL_MS` is set and > 0
   - **Verify**: Second call within TTL returns `meta.cached: true`

4. **UI Not Showing**:
   - **Check**: `WEBACY_ENABLED=1` and `WEBACY_API_KEY` is set
   - **Note**: UI silently hides if disabled/not configured (by design)

5. **Holder Analysis Shows as Premium/Locked**:
   - **Expected**: Demo API keys typically return 403 for Holder Analysis
   - **Behavior**: Transformed to HTTP 200 with `restricted: true` (not an error)
   - **UI**: Shows elegant "Premium Feature" message (not red error)
   - **Cache**: Negative cache prevents repeated 403 calls (30 min TTL)

---

## Future Enhancements

1. **Redis Cache**: Shared cache across serverless instances (if needed)
2. **Metrics Dashboard**: Track cache hit rate, API usage, errors
3. **Webhook Support**: Real-time updates when Webacy data changes
4. **Additional Endpoints**: Support more Webacy DD endpoints as needed

---

## References

- **Webacy API Docs**: https://docs.webacy.com
- **Integration Doc**: `WEBACY_INTEGRATION.md`
- **Source Code**: 
  - `src/lib/webacy.ts` - Core integration
  - `src/app/api/dd/trading-lite/route.ts` - Trading Lite endpoint
  - `src/app/api/dd/holder-analysis/route.ts` - Holder Analysis endpoint
  - `src/components/webacy/WebacySignals.tsx` - UI component

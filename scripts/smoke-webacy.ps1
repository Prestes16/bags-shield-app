param(
  [Parameter(Mandatory=$true)]
  [string]$BaseUrl,

  [Parameter(Mandatory=$true)]
  [string]$Mint,

  [string]$Chain = "sol"
)

# Console em UTF-8 (sem BOM) — evita símbolos quebrados
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch {}

function Read-JsonBody([string]$raw) {
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  try { return ($raw | ConvertFrom-Json) } catch { return $null }
}

function Invoke-JsonGet([string]$Url) {
  $result = [ordered]@{
    url        = $Url
    statusCode = $null
    body       = $null
    error      = $null
  }

  try {
    $resp = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -ErrorAction Stop
    $result.statusCode = [int]$resp.StatusCode
    $result.body = Read-JsonBody $resp.Content
    return [pscustomobject]$result
  } catch {
    $ex = $_.Exception
    $status = $null
    $raw = $null

    try {
      if ($ex.Response -and $ex.Response.StatusCode) {
        $status = [int]$ex.Response.StatusCode.value__
      }
      if ($ex.Response -and $ex.Response.GetResponseStream) {
        $reader = New-Object System.IO.StreamReader($ex.Response.GetResponseStream())
        $raw = $reader.ReadToEnd()
      }
    } catch {}

    if (-not $status) { $status = 0 }
    $result.statusCode = $status
    $result.body = Read-JsonBody $raw
    $result.error = ($ex.Message | Out-String).Trim()
    return [pscustomobject]$result
  }
}

function Show-Meta([object]$Body) {
  if ($null -eq $Body) { return "{}" }
  $meta = $Body.meta
  if ($null -eq $meta) { return "{}" }
  try { return ($meta | ConvertTo-Json -Compress) } catch { return "{}" }
}

$pass = 0
$fail = 0

Write-Host ""
Write-Host "=== Webacy/DD Integration Smoke Test ===" -ForegroundColor Cyan
Write-Host ("Base URL: {0}" -f $BaseUrl)
Write-Host ("Test Mint: {0}" -f $Mint)
Write-Host ("Chain: {0}" -f $Chain)

# Test 1: Trading Lite (first call)
Write-Host ""
Write-Host ("Test 1: GET /api/dd/trading-lite?mint={0}&chain={1} (first call)" -f $Mint, $Chain) -ForegroundColor Yellow
$url1 = "$BaseUrl/api/dd/trading-lite?mint=$Mint&chain=$Chain"
$r1 = Invoke-JsonGet $url1
$ok1 = ($r1.statusCode -eq 200 -and $r1.body -and $r1.body.success -eq $true)

if ($ok1) {
  $pass++
  Write-Host ("PASS - Trading Lite (first call) (HTTP {0})" -f $r1.statusCode) -ForegroundColor Green
  Write-Host ("  Meta: {0}" -f (Show-Meta $r1.body))
} else {
  $fail++
  Write-Host ("FAIL - Trading Lite (first call) (HTTP {0})" -f $r1.statusCode) -ForegroundColor Red
  Write-Host ("  Meta: {0}" -f (Show-Meta $r1.body))
  if ($r1.error) { Write-Host ("  Error: {0}" -f $r1.error) -ForegroundColor DarkRed }
}

# Test 1b: Trading Lite (second call - cache hint)
Write-Host ""
Write-Host ("Test 1b: GET /api/dd/trading-lite?mint={0}&chain={1} (second call - cache test)" -f $Mint, $Chain) -ForegroundColor Yellow
Start-Sleep -Milliseconds 300

$r1b = Invoke-JsonGet $url1
$ok1b = ($r1b.statusCode -eq 200 -and $r1b.body -and $r1b.body.success -eq $true)

if ($ok1b) {
  $pass++
  Write-Host ("PASS - Trading Lite (second call) (HTTP {0})" -f $r1b.statusCode) -ForegroundColor Green
  Write-Host ("  Meta: {0}" -f (Show-Meta $r1b.body))

  $cached = $false
  try { $cached = ($r1b.body.meta.cached -eq $true) } catch {}
  if ($cached) {
    Write-Host "  Cache OK: meta.cached=true" -ForegroundColor Green
  } else {
    Write-Host "  Cache WARN: meta.cached=false (pode acontecer se TTL=0)" -ForegroundColor Yellow
  }
} else {
  $fail++
  Write-Host ("FAIL - Trading Lite (second call) (HTTP {0})" -f $r1b.statusCode) -ForegroundColor Red
  Write-Host ("  Meta: {0}" -f (Show-Meta $r1b.body))
  if ($r1b.error) { Write-Host ("  Error: {0}" -f $r1b.error) -ForegroundColor DarkRed }
}

# Test 2: Holder Analysis (can be Premium/Locked)
Write-Host ""
Write-Host ("Test 2: GET /api/dd/holder-analysis?mint={0}&chain={1}" -f $Mint, $Chain) -ForegroundColor Yellow
$url2 = "$BaseUrl/api/dd/holder-analysis?mint=$Mint&chain=$Chain"
$r2 = Invoke-JsonGet $url2

$isRestricted = $false
try { $isRestricted = ($r2.body -and $r2.body.meta -and $r2.body.meta.restricted -eq $true) } catch {}

$ok2 = ($r2.statusCode -eq 200 -and $r2.body -and $r2.body.success -eq $true)

if ($ok2) {
  $pass++
  if ($isRestricted) {
    Write-Host ("PASS - Holder Analysis (LOCKED/Premium demo) (HTTP {0})" -f $r2.statusCode) -ForegroundColor Green
  } else {
    Write-Host ("PASS - Holder Analysis (HTTP {0})" -f $r2.statusCode) -ForegroundColor Green
  }
  Write-Host ("  Meta: {0}" -f (Show-Meta $r2.body))
} else {
  # 412/503 => sanity de env/config (aceita como PASS do smoke)
  $softPass = ($r2.statusCode -eq 412 -or $r2.statusCode -eq 503)
  if ($softPass) {
    $pass++
    Write-Host ("PASS - Holder Analysis (env gate) (HTTP {0})" -f $r2.statusCode) -ForegroundColor Yellow
    Write-Host ("  Meta: {0}" -f (Show-Meta $r2.body))
  } else {
    $fail++
    Write-Host ("FAIL - Holder Analysis (HTTP {0})" -f $r2.statusCode) -ForegroundColor Red
    Write-Host ("  Meta: {0}" -f (Show-Meta $r2.body))
    if ($r2.error) { Write-Host ("  Error: {0}" -f $r2.error) -ForegroundColor DarkRed }
  }
}

# Test 3: Trading Lite (missing mint) => expect 400 (PASS)
Write-Host ""
Write-Host "Test 3: GET /api/dd/trading-lite (missing mint)" -ForegroundColor Yellow
$url3 = "$BaseUrl/api/dd/trading-lite"
$r3 = Invoke-JsonGet $url3

if ($r3.statusCode -eq 400) {
  $pass++
  Write-Host "PASS - Trading Lite missing mint returned 400 (validation OK)" -ForegroundColor Green
  Write-Host ("  Meta: {0}" -f (Show-Meta $r3.body))
} else {
  $fail++
  Write-Host ("FAIL - Trading Lite missing mint expected 400, got {0}" -f $r3.statusCode) -ForegroundColor Red
  Write-Host ("  Meta: {0}" -f (Show-Meta $r3.body))
}

# Test 4: Holder Analysis (invalid mint) => expect 400 (PASS)
Write-Host ""
Write-Host "Test 4: GET /api/dd/holder-analysis?mint=invalid" -ForegroundColor Yellow
$url4 = "$BaseUrl/api/dd/holder-analysis?mint=invalid&chain=$Chain"
$r4 = Invoke-JsonGet $url4

if ($r4.statusCode -eq 400) {
  $pass++
  Write-Host "PASS - Holder Analysis invalid mint returned 400 (validation OK)" -ForegroundColor Green
  Write-Host ("  Meta: {0}" -f (Show-Meta $r4.body))
} else {
  $fail++
  Write-Host ("FAIL - Holder Analysis invalid mint expected 400, got {0}" -f $r4.statusCode) -ForegroundColor Red
  Write-Host ("  Meta: {0}" -f (Show-Meta $r4.body))
}

Write-Host ""
Write-Host ("=== Smoke Test Complete ===  PASS={0}  FAIL={1}" -f $pass, $fail) -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 } else { exit 0 }
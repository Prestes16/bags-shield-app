param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" # USDC
)

Write-Host "`n=== Smoke Test: Helius Budget Enforcement ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl"
Write-Host "Mint: $Mint"
Write-Host ""

$errors = 0
$warnings = 0

# Test 1: First scan (should call Helius)
Write-Host "[1/2] First scan (cold cache)..." -ForegroundColor Yellow
try {
  $body = @{ mint = $Mint } | ConvertTo-Json
  $r1 = Invoke-RestMethod -Uri "$BaseUrl/api/scan" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
  
  if ($r1.success -and $r1.meta.helius) {
    $h1 = $r1.meta.helius
    Write-Host "  Calls: $($h1.calls)" -ForegroundColor $(if ($h1.calls -le 1) { "Green" } else { "Red" })
    Write-Host "  Mode: $($h1.mode)" -ForegroundColor $(if ($h1.mode -eq "das") { "Green" } else { "Yellow" })
    Write-Host "  Degraded: $($r1.meta.degraded)" -ForegroundColor $(if (-not $r1.meta.degraded) { "Green" } else { "Yellow" })
    
    if ($h1.calls -gt 1) {
      Write-Host "  WARNING: More than 1 call on first scan!" -ForegroundColor Red
      $warnings++
    }
    if ($r1.meta.degraded -and $h1.mode -eq "das") {
      Write-Host "  ERROR: Degraded=true but mode=das (inconsistent)" -ForegroundColor Red
      $errors++
    }
  }
  else {
    Write-Host "  ERROR: Missing helius meta" -ForegroundColor Red
    $errors++
  }
}
catch {
  Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $errors++
}

Start-Sleep -Seconds 1

# Test 2: Second scan (should use cache, fewer calls)
Write-Host "`n[2/2] Second scan (should hit cache)..." -ForegroundColor Yellow
try {
  $body = @{ mint = $Mint } | ConvertTo-Json
  $r2 = Invoke-RestMethod -Uri "$BaseUrl/api/scan" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
  
  if ($r2.success -and $r2.meta.helius) {
    $h2 = $r2.meta.helius
    Write-Host "  Calls: $($h2.calls)" -ForegroundColor $(if ($h2.calls -le 1) { "Green" } else { "Red" })
    Write-Host "  Mode: $($h2.mode)" -ForegroundColor $(if ($h2.mode -eq "das") { "Green" } else { "Yellow" })
    Write-Host "  Cache: $($h2.cache)" -ForegroundColor $(if ($h2.cache -eq "hit") { "Green" } else { "Yellow" })
    
    if ($h2.calls -gt 1) {
      Write-Host "  WARNING: More than 1 call on cached scan!" -ForegroundColor Red
      $warnings++
    }
  }
  else {
    Write-Host "  ERROR: Missing helius meta" -ForegroundColor Red
    $errors++
  }
}
catch {
  Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $errors++
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Errors: $errors" -ForegroundColor $(if ($errors -eq 0) { "Green" } else { "Red" })
Write-Host "Warnings: $warnings" -ForegroundColor $(if ($warnings -eq 0) { "Green" } else { "Yellow" })

if ($errors -eq 0 -and $warnings -eq 0) {
  Write-Host "`nPASS: Helius budget enforcement working correctly" -ForegroundColor Green
  exit 0
}
else {
  Write-Host "`nFAIL: Issues detected" -ForegroundColor Red
  exit 1
}

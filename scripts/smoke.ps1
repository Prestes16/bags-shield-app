# Smoke tests for Bags Shield App
# Tests /api/health, /api/scan, and cache endpoints

param(
    [string]$BaseUrl = "http://localhost:3000",
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [int]$ExpectedStatus = 200
    )

    try {
        $headers = @{
            "Content-Type" = "application/json"
        }

        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $headers
            TimeoutSec = 30
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        $response = Invoke-WebRequest @params -UseBasicParsing
        $statusCode = $response.StatusCode
        $content = $response.Content | ConvertFrom-Json

        if ($statusCode -eq $ExpectedStatus) {
            Write-ColorOutput Green "✓ $Method $Url - Status: $statusCode"
            if ($Verbose) {
                Write-Output "  Response: $($content | ConvertTo-Json -Depth 3)"
            }
            return @{ Success = $true; StatusCode = $statusCode; Content = $content }
        } else {
            Write-ColorOutput Red "✗ $Method $Url - Expected $ExpectedStatus, got $statusCode"
            return @{ Success = $false; StatusCode = $statusCode; Content = $content }
        }
    } catch {
        Write-ColorOutput Red "✗ $Method $Url - Error: $($_.Exception.Message)"
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

Write-ColorOutput Cyan "=========================================="
Write-ColorOutput Cyan "Bags Shield App - Smoke Tests"
Write-ColorOutput Cyan "Base URL: $BaseUrl"
Write-ColorOutput Cyan "=========================================="
Write-Output ""

$results = @()

# Test 1: Health endpoint
Write-ColorOutput Yellow "Test 1: Health Endpoint"
$healthResult = Test-Endpoint -Url "$BaseUrl/api/health" -Method "GET" -ExpectedStatus 200
$results += @{ Test = "Health"; Result = $healthResult }

if ($healthResult.Success -and $healthResult.Content.success) {
    Write-ColorOutput Green "  ✓ Health check passed"
} else {
    Write-ColorOutput Red "  ✗ Health check failed"
}
Write-Output ""

# Test 2: Features endpoint
Write-ColorOutput Yellow "Test 2: Features Endpoint"
$featuresResult = Test-Endpoint -Url "$BaseUrl/api/features" -Method "GET" -ExpectedStatus 200
$results += @{ Test = "Features"; Result = $featuresResult }

if ($featuresResult.Success -and $featuresResult.Content.success) {
    Write-ColorOutput Green "  ✓ Features endpoint working"
    if ($Verbose) {
        Write-Output "  Feature flags: $($featuresResult.Content.response | ConvertTo-Json)"
    }
    # Check fees config
    if ($featuresResult.Content.response.fees) {
        Write-ColorOutput Green "  ✓ Fees config present"
        if ($Verbose) {
            Write-Output "  Fees: $($featuresResult.Content.response.fees | ConvertTo-Json)"
        }
    }
} else {
    Write-ColorOutput Red "  ✗ Features endpoint failed"
}
Write-Output ""

# Test 2.5: Helius status endpoint
Write-ColorOutput Yellow "Test 2.5: Helius Status Endpoint"
$heliusStatusResult = Test-Endpoint -Url "$BaseUrl/api/helius/status" -Method "GET" -ExpectedStatus 200
$results += @{ Test = "Helius Status"; Result = $heliusStatusResult }

if ($heliusStatusResult.Success -and $heliusStatusResult.Content.success) {
    Write-ColorOutput Green "  ✓ Helius status endpoint working"
    $status = $heliusStatusResult.Content.response
    Write-ColorOutput Gray "    configured: $($status.configured)"
    Write-ColorOutput Gray "    cluster: $($status.cluster)"
    Write-ColorOutput Gray "    enabled: $($status.enabled)"
    if ($Verbose) {
        Write-Output "  Status: $($status | ConvertTo-Json)"
    }
} else {
    Write-ColorOutput Red "  ✗ Helius status endpoint failed"
}
Write-Output ""

# Test 2.6: RPC status endpoint
Write-ColorOutput Yellow "Test 2.6: RPC Status Endpoint"
$rpcStatusResult = Test-Endpoint -Url "$BaseUrl/api/rpc/status" -Method "GET" -ExpectedStatus 200
$results += @{ Test = "RPC Status"; Result = $rpcStatusResult }

if ($rpcStatusResult.Success -and $rpcStatusResult.Content.success) {
    Write-ColorOutput Green "  ✓ RPC status endpoint working"
    $status = $rpcStatusResult.Content.response
    Write-ColorOutput Gray "    configured: $($status.configured)"
    Write-ColorOutput Gray "    urlKind: $($status.urlKind)"
    Write-ColorOutput Gray "    ok: $($status.ok)"
    if ($status.latencyMs) {
        Write-ColorOutput Gray "    latencyMs: $($status.latencyMs)"
    }
    if ($Verbose) {
        Write-Output "  Status: $($status | ConvertTo-Json)"
    }
} else {
    Write-ColorOutput Red "  ✗ RPC status endpoint failed"
}
Write-Output ""

# Test 3: Scan endpoint (with valid mint)
Write-ColorOutput Yellow "Test 3: Scan Endpoint"
# Using a known token mint (USDC on Solana mainnet)
$testMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
$scanBody = @{
    mint = $testMint
}
$scanResult = Test-Endpoint -Url "$BaseUrl/api/scan" -Method "POST" -Body $scanBody -ExpectedStatus 200
$results += @{ Test = "Scan"; Result = $scanResult }

if ($scanResult.Success -and $scanResult.Content.success) {
    Write-ColorOutput Green "  ✓ Scan endpoint working"
    if ($scanResult.Content.meta.fromCache) {
        Write-ColorOutput Yellow "  ⚠ Response from cache"
    }
    if ($scanResult.Content.meta.source -eq "rpc_fallback") {
        Write-ColorOutput Yellow "  ⚠ Using RPC fallback"
    }
    # Check dataSources meta
    if ($scanResult.Content.meta.dataSources) {
        Write-ColorOutput Green "  ✓ dataSources meta present"
        $ds = $scanResult.Content.meta.dataSources
        Write-ColorOutput Gray "    heliusDas: $($ds.heliusDas)"
        Write-ColorOutput Gray "    rpcFallback: $($ds.rpcFallback)"
        Write-ColorOutput Gray "    cache: $($ds.cache)"
        # Validate dataSources structure
        if ($ds.heliusDas -in @("ok", "fail", "skipped") -and 
            $ds.rpcFallback -in @("ok", "fail", "skipped") -and 
            $ds.cache -in @("hit", "miss", "stale")) {
            Write-ColorOutput Green "  ✓ dataSources structure valid"
        } else {
            Write-ColorOutput Red "  ✗ dataSources structure invalid"
        }
    } else {
        Write-ColorOutput Yellow "  ⚠ dataSources meta missing (may be from old version)"
    }
} else {
    Write-ColorOutput Red "  ✗ Scan endpoint failed"
    if ($scanResult.Error) {
        Write-ColorOutput Red "    Error: $($scanResult.Error)"
    }
}
Write-Output ""

# Test 4: Scan endpoint (invalid mint)
Write-ColorOutput Yellow "Test 4: Scan Endpoint (Invalid Mint)"
$invalidScanBody = @{
    mint = "invalid-mint-address"
}
$invalidScanResult = Test-Endpoint -Url "$BaseUrl/api/scan" -Method "POST" -Body $invalidScanBody -ExpectedStatus 400
$results += @{ Test = "Scan Invalid"; Result = $invalidScanResult }

if ($invalidScanResult.Success) {
    Write-ColorOutput Green "  ✓ Invalid mint correctly rejected"
} else {
    Write-ColorOutput Red "  ✗ Invalid mint not properly rejected"
}
Write-Output ""

# Test 5: Pro Scan verify (invalid signature)
Write-ColorOutput Yellow "Test 5: Pro Scan Verify (Invalid Signature)"
$invalidVerifyBody = @{
    signature = "invalid_signature_12345"
}
$verifyResult = Test-Endpoint -Url "$BaseUrl/api/pro/verify" -Method "POST" -Body $invalidVerifyBody -ExpectedStatus 200
$results += @{ Test = "Pro Verify Invalid"; Result = $verifyResult }

if ($verifyResult.Success -and $verifyResult.Content.success) {
    if ($verifyResult.Content.response.valid -eq $false) {
        Write-ColorOutput Green "  ✓ Invalid signature correctly rejected"
    } else {
        Write-ColorOutput Red "  ✗ Invalid signature not properly rejected"
    }
} else {
    Write-ColorOutput Yellow "  ⚠ Pro Scan verify may not be enabled (expected if PRO_SCAN_ENABLED=false)"
}
Write-Output ""

# Test 6: Scan with pro=true (should 402 or 403)
Write-ColorOutput Yellow "Test 6: Scan with Pro Request (No Signature)"
$proScanBody = @{
    mint = $testMint
    pro = $true
}
$proScanResult = Test-Endpoint -Url "$BaseUrl/api/scan" -Method "POST" -Body $proScanBody -ExpectedStatus 402
$results += @{ Test = "Pro Scan No Payment"; Result = $proScanResult }

if ($proScanResult.Success) {
    Write-ColorOutput Green "  ✓ Pro Scan correctly requires payment (402)"
} elseif ($proScanResult.StatusCode -eq 403) {
    Write-ColorOutput Yellow "  ⚠ Pro Scan disabled (403) - expected if PRO_SCAN_ENABLED=false"
} else {
    Write-ColorOutput Yellow "  ⚠ Pro Scan test inconclusive (may be disabled)"
}
Write-Output ""

# Test 7: Cache behavior (second scan should be faster/cached)
Write-ColorOutput Yellow "Test 7: Cache Behavior"
$cacheTestMint = "So11111111111111111111111111111111111111112" # SOL
$cacheBody = @{
    mint = $cacheTestMint
}

# First request
$start1 = Get-Date
$cacheResult1 = Test-Endpoint -Url "$BaseUrl/api/scan" -Method "POST" -Body $cacheBody -ExpectedStatus 200
$elapsed1 = (Get-Date) - $start1

# Second request (should be cached)
Start-Sleep -Seconds 1
$start2 = Get-Date
$cacheResult2 = Test-Endpoint -Url "$BaseUrl/api/scan" -Method "POST" -Body $cacheBody -ExpectedStatus 200
$elapsed2 = (Get-Date) - $start2

$results += @{ Test = "Cache"; Result = @{ First = $cacheResult1; Second = $cacheResult2 } }

if ($cacheResult1.Success -and $cacheResult2.Success) {
    if ($cacheResult2.Content.meta.fromCache) {
        Write-ColorOutput Green "  ✓ Cache working (second request from cache)"
    } else {
        Write-ColorOutput Yellow "  ⚠ Cache may not be enabled or TTL expired"
    }
    Write-Output "  First request: $($elapsed1.TotalMilliseconds)ms"
    Write-Output "  Second request: $($elapsed2.TotalMilliseconds)ms"
} else {
    Write-ColorOutput Red "  ✗ Cache test failed"
}
Write-Output ""

# Summary
Write-ColorOutput Cyan "=========================================="
Write-ColorOutput Cyan "Test Summary"
Write-ColorOutput Cyan "=========================================="

$passed = ($results | Where-Object { $_.Result.Success -or ($_.Result.First -and $_.Result.First.Success) }).Count
$total = $results.Count

Write-Output "Passed: $passed / $total"

if ($passed -eq $total) {
    Write-ColorOutput Green "All tests passed!"
    exit 0
} else {
    Write-ColorOutput Red "Some tests failed"
    exit 1
}

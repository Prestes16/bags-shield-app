# Integration test script
# Validates code structure and common issues

$ErrorActionPreference = "Continue"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Cyan "=========================================="
Write-ColorOutput Cyan "Bags Shield App - Integration Tests"
Write-ColorOutput Cyan "=========================================="
Write-Output ""

$errors = @()
$warnings = @()

# Test 1: Check if required files exist
Write-ColorOutput Yellow "Test 1: Required Files Check"
$requiredFiles = @(
    "src/lib/security.ts",
    "src/lib/cache.ts",
    "src/lib/featureFlags.ts",
    "src/lib/walletAdapter.ts",
    "src/lib/mobileWalletAdapter.ts",
    "src/lib/jupiter.ts",
    "src/hooks/useWallet.ts",
    "src/hooks/useFeatureFlags.ts",
    "src/components/wallet/WalletDetected.tsx",
    "src/components/jupiter/JupiterSwap.tsx",
    "src/components/shared/CacheStatusBadge.tsx",
    "src/app/api/scan/route.ts",
    "src/app/api/features/route.ts",
    "src/app/api/jupiter/quote/route.ts",
    "src/app/api/jupiter/swap/route.ts"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-ColorOutput Green "  OK $file"
    } else {
        Write-ColorOutput Red "  FAIL $file - MISSING"
        $errors += "Missing file: $file"
    }
}
Write-Output ""

# Test 2: Check TypeScript compilation
Write-ColorOutput Yellow "Test 2: TypeScript Compilation"
try {
    $null = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "  OK TypeScript compilation successful"
    } else {
        Write-ColorOutput Red "  FAIL TypeScript compilation failed"
        $errors += "TypeScript compilation failed"
    }
} catch {
    Write-ColorOutput Red "  FAIL Build check failed: $($_.Exception.Message)"
    $errors += "Build check failed"
}
Write-Output ""

# Test 3: Check API routes have security
Write-ColorOutput Yellow "Test 3: API Routes Security Check"
$apiRoutes = @(
    "src/app/api/scan/route.ts",
    "src/app/api/features/route.ts",
    "src/app/api/jupiter/quote/route.ts",
    "src/app/api/jupiter/swap/route.ts"
)

foreach ($route in $apiRoutes) {
    if (Test-Path $route) {
        $content = Get-Content $route -Raw
        $hasSecurity = $false
        $hasRequestId = $false
        
        if ($content -match "jsonNoStore") {
            $hasSecurity = $true
        }
        if ($content -match "getRequestId") {
            $hasRequestId = $true
        }
        
        if ($hasSecurity -and $hasRequestId) {
            Write-ColorOutput Green "  OK $route - Has security"
        } else {
            $warnings += "$route - Missing security features"
            Write-ColorOutput Yellow "  WARN $route - May be missing security"
        }
    }
}
Write-Output ""

# Summary
Write-ColorOutput Cyan "=========================================="
Write-ColorOutput Cyan "Test Summary"
Write-ColorOutput Cyan "=========================================="

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-ColorOutput Green "All checks passed!"
    exit 0
} else {
    if ($errors.Count -gt 0) {
        Write-ColorOutput Red "Errors: $($errors.Count)"
        foreach ($error in $errors) {
            Write-ColorOutput Red "  - $error"
        }
    }
    if ($warnings.Count -gt 0) {
        Write-ColorOutput Yellow "Warnings: $($warnings.Count)"
        foreach ($warning in $warnings) {
            Write-ColorOutput Yellow "  - $warning"
        }
    }
    exit 1
}

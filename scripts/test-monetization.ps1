# Testes de Monetiza��o V1 - Bags Shield App
# Testa endpoints relacionados a fees e Pro Scan

param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testes de Monetiza��o V1" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$testResults = @()

# Helper para fazer chamadas curl.exe com JSON via stdin (evita problemas de escaping do PowerShell)
# Usa --data-binary '@-' para enviar JSON via pipeline, garantindo que aspas n�o sejam corrompidas
function Invoke-CurlJsonStdIn {
    param(
        [string]$Url,
        [object]$Json,  # Pode ser objeto PS ou string JSON
        [string[]]$ExtraHeaders = @()  # Headers extras opcionais (ex: -H "X-Custom: value")
    )
    
    # Converter para JSON string se necess�rio
    $jsonString = if ($Json -is [string]) {
        $Json
    } else {
        $Json | ConvertTo-Json -Compress
    }
    
    # Headers padr�o sempre inclu�dos
    $headers = @(
        '-H', 'Accept: application/json',
        '-H', 'Content-Type: application/json'
    )
    
    # Adicionar headers extras se fornecidos
    foreach ($header in $ExtraHeaders) {
        $headers += '-H', $header
    }
    
    # Construir comando curl.exe
    # --data-binary '@-' l� do stdin (via pipeline)
    # -sS: silencioso mas mostra erros
    # -w '\n%{http_code}': adiciona status code no final
    $curlArgs = @(
        '-sS',
        '-w', "`n%{http_code}",
        $Url,
        '-X', 'POST'
    ) + $headers + @(
        '--data-binary', '@-'
    )
    
    # Enviar JSON via pipeline para curl.exe
    # '@-' � passado literalmente para curl.exe, que l� do stdin
    # O PowerShell redireciona o pipeline ($jsonString) para stdin do curl.exe
    $output = $jsonString | & curl.exe $curlArgs 2>&1
    
    # Separar body e status code
    $lines = $output -split "`n"
    $statusCode = [int]($lines[-1] -replace '[^0-9]', '')
    $body = ($lines[0..($lines.Count - 2)] -join "`n")
    
    return @{
        StatusCode = $statusCode
        Body = $body
        Content = $body
    }
}

# Test 1: Features endpoint com fees
Write-Host "Test 1: Features Endpoint (com fees config)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/features" -Method GET -UseBasicParsing -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success -and $data.response.fees) {
        Write-Host "  OK Features endpoint retorna fees config" -ForegroundColor Green
        Write-Host "    proScanEnabled: $($data.response.fees.proScanEnabled)" -ForegroundColor Gray
        Write-Host "    proScanLamports: $($data.response.fees.proScanLamports)" -ForegroundColor Gray
        Write-Host "    appFeeBps: $($data.response.fees.appFeeBps)" -ForegroundColor Gray
        $testResults += @{ Test = "Features"; Status = "PASS" }
    } else {
        Write-Host "  FAIL Features endpoint nao retorna fees config" -ForegroundColor Red
        $testResults += @{ Test = "Features"; Status = "FAIL" }
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{ Test = "Features"; Status = "ERROR"; Error = $_.Exception.Message }
}
Write-Host ""

# Test 2: Pro Scan verify (invalid signature)
Write-Host "Test 2: Pro Scan Verify (Invalid Signature)" -ForegroundColor Yellow
try {
    $body = @{
        signature = "invalid_signature_12345"
    }
    
    $response = Invoke-CurlJsonStdIn -Url "$BaseUrl/api/pro/verify" -Json $body
    $statusCode = $response.StatusCode
    $data = $response.Body | ConvertFrom-Json -ErrorAction Stop
    
    if ($statusCode -eq 200 -and $data.success -and $data.response.valid -eq $false) {
        Write-Host "  OK Invalid signature corretamente rejeitada" -ForegroundColor Green
        Write-Host "    Reason: $($data.response.reason)" -ForegroundColor Gray
        $testResults += @{ Test = "Pro Verify Invalid"; Status = "PASS" }
    } elseif ($statusCode -eq 400) {
        Write-Host "  ERROR Retornou 400 (malformed request) - JSON pode ter sido corrompido" -ForegroundColor Red
        $testResults += @{ Test = "Pro Verify Invalid"; Status = "ERROR"; Error = "Unexpected 400" }
    } elseif ($statusCode -eq 404) {
        Write-Host "  ERROR Endpoint nao encontrado (servidor pode nao estar rodando)" -ForegroundColor Red
        $testResults += @{ Test = "Pro Verify Invalid"; Status = "ERROR"; Error = "Endpoint not found" }
    } else {
        Write-Host "  WARN Pro Scan verify pode estar desabilitado (esperado se PRO_SCAN_ENABLED=false)" -ForegroundColor Yellow
        Write-Host "    Status: $statusCode" -ForegroundColor Gray
        $testResults += @{ Test = "Pro Verify Invalid"; Status = "WARN"; StatusCode = $statusCode }
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{ Test = "Pro Verify Invalid"; Status = "ERROR"; Error = $_.Exception.Message }
}
Write-Host ""

# Test 3: Scan com pro=true (sem signature)
Write-Host "Test 3: Scan com Pro Request (Sem Signature)" -ForegroundColor Yellow
try {
    $body = @{
        mint = "So11111111111111111111111111111111111111112"
        pro = $true
    }
    
    $response = Invoke-CurlJsonStdIn -Url "$BaseUrl/api/scan" -Json $body
    $statusCode = $response.StatusCode
    
    if ($statusCode -eq 402) {
        Write-Host "  OK Pro Scan corretamente requer pagamento (402)" -ForegroundColor Green
        $testResults += @{ Test = "Pro Scan No Payment"; Status = "PASS"; StatusCode = $statusCode }
    } elseif ($statusCode -eq 403) {
        Write-Host "  WARN Pro Scan desabilitado (403) - esperado se PRO_SCAN_ENABLED=false" -ForegroundColor Yellow
        $testResults += @{ Test = "Pro Scan No Payment"; Status = "WARN"; StatusCode = $statusCode }
    } elseif ($statusCode -eq 200) {
        Write-Host "  WARN Status $statusCode (esperado 402 ou 403)" -ForegroundColor Yellow
        $testResults += @{ Test = "Pro Scan No Payment"; Status = "WARN"; StatusCode = $statusCode }
    } else {
        Write-Host "  ERROR Status inesperado: $statusCode" -ForegroundColor Red
        $testResults += @{ Test = "Pro Scan No Payment"; Status = "ERROR"; StatusCode = $statusCode }
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{ Test = "Pro Scan No Payment"; Status = "ERROR"; Error = $_.Exception.Message }
}
Write-Host ""

# Test 4: Scan normal (sem pro)
Write-Host "Test 4: Scan Normal (Sem Pro)" -ForegroundColor Yellow
try {
    $body = @{
        mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    }
    
    $response = Invoke-CurlJsonStdIn -Url "$BaseUrl/api/scan" -Json $body
    $statusCode = $response.StatusCode
    
    if ($statusCode -eq 200) {
        $data = $response.Body | ConvertFrom-Json -ErrorAction Stop
        
        if ($data.success) {
            Write-Host "  OK Scan normal funcionando" -ForegroundColor Green
            if ($data.meta.pro) {
                Write-Host "    WARN meta.pro presente (deveria ser false ou ausente)" -ForegroundColor Yellow
            } else {
                Write-Host "    OK meta.pro nao presente (correto)" -ForegroundColor Green
            }
            $testResults += @{ Test = "Scan Normal"; Status = "PASS" }
        } else {
            Write-Host "  FAIL Scan falhou: $($data.error)" -ForegroundColor Red
            $testResults += @{ Test = "Scan Normal"; Status = "FAIL"; Error = $data.error }
        }
    } else {
        Write-Host "  ERROR Status inesperado: $statusCode" -ForegroundColor Red
        Write-Host "    Body: $($response.Body)" -ForegroundColor Gray
        $testResults += @{ Test = "Scan Normal"; Status = "ERROR"; StatusCode = $statusCode }
    }
} catch {
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{ Test = "Scan Normal"; Status = "ERROR"; Error = $_.Exception.Message }
}
Write-Host ""

# Summary
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Resumo dos Testes" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$passed = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$warned = ($testResults | Where-Object { $_.Status -eq "WARN" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "FAIL" -or $_.Status -eq "ERROR" }).Count
$total = $testResults.Count

foreach ($result in $testResults) {
    $color = if ($result.Status -eq "PASS") { "Green" } elseif ($result.Status -eq "WARN") { "Yellow" } else { "Red" }
    Write-Host "  $($result.Test): $($result.Status)" -ForegroundColor $color
}

Write-Host ""
Write-Host "Total: $total | Passou: $passed | Avisos: $warned | Falhou: $failed" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host ""
    Write-Host "Todos os testes principais passaram!" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "Alguns testes falharam. Verifique os erros acima." -ForegroundColor Red
    exit 1
}

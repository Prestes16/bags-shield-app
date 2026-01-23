# Teste de Segurança e Vulnerabilidades - API Routes
# Testa todas as rotas de API por erros e vulnerabilidades comuns

# Fix encoding para evitar mojibake
$OutputEncoding = [System.Text.UTF8Encoding]::new()

$base = "http://localhost:3000"
$errors = @()
$warnings = @()

Write-Host "=== Teste de Segurança - API Routes ===" -ForegroundColor Cyan
Write-Host ""

# Teste 1: Validação de Input - Mint inválido
Write-Host "1. Testando validação de mint inválido..." -ForegroundColor Yellow
# GARANTE tipo certo (string[])
[string[]]$invalidMints = @(
    "",
    "a",
    "123",
    "So1111111111111111111111111111111111111111", # 43 chars (muito curto)
    "So111111111111111111111111111111111111111111", # 45 chars (muito longo)
    "So1111111111111111111111111111111111111111O", # Contém 'O' (inválido Base58)
    "So11111111111111111111111111111111111111110", # Contém '0' (inválido Base58)
    "../../etc/passwd", # Path traversal
    "<script>alert('xss')</script>", # XSS attempt
    "'; DROP TABLE users; --", # SQL injection attempt
    "http://evil.com", # URL injection
    "`n`r", # Newlines
    " " * 100, # Muito espaço
    "A" * 1000 # String muito longa
)

foreach ($invalid in $invalidMints) {
    $body = @{ mint = $invalid } | ConvertTo-Json -Compress
    try {
        $r = curl.exe -sS "$base/api/scan" -H "Content-Type: application/json" --data-raw $body 2>&1
        $o = $r | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($o -and $o.success -eq $true) {
            $errors += "❌ Mint inválido aceito: '$invalid'"
        }
    } catch {
        # Esperado - erro de parse
    }
}
Write-Host "   ✅ Validação de mint testada" -ForegroundColor Green

# Teste 2: SSRF (Server-Side Request Forgery) - Tentar fazer proxy fazer request interno
Write-Host "`n2. Testando SSRF protection..." -ForegroundColor Yellow
$ssrfTargets = @(
    "http://127.0.0.1",
    "http://localhost",
    "http://169.254.169.254", # AWS metadata
    "http://[::1]",
    "file:///etc/passwd",
    "gopher://evil.com",
    "http://localhost:3000/api/ping" # Internal endpoint
)

Remove-Item Env:\BAGS_SHIELD_API_BASE -ErrorAction SilentlyContinue
foreach ($target in $ssrfTargets) {
    $env:BAGS_SHIELD_API_BASE = $target
    $body = @{ mint = "So11111111111111111111111111111111111111112" } | ConvertTo-Json -Compress
    try {
        $r = curl.exe -sS "$base/api/scan" -H "Content-Type: application/json" --data-raw $body -m 5 2>&1
        $o = $r | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($o -and $o.success -eq $true -and $o.response) {
            $warnings += "⚠️  Possível SSRF: backend configurado para $target retornou sucesso"
        }
    } catch {
        # Esperado
    }
}
Write-Host "   ✅ SSRF testado" -ForegroundColor Green

# Teste 3: Rate Limiting / Timeout
Write-Host "`n3. Testando timeouts e rate limiting..." -ForegroundColor Yellow
$env:BAGS_SHIELD_API_BASE = "https://httpstat.us/200?sleep=30000" # 30s delay
$body = @{ mint = "So11111111111111111111111111111111111111112" } | ConvertTo-Json -Compress
$start = Get-Date
try {
    $r = curl.exe -sS "$base/api/scan" -H "Content-Type: application/json" --data-raw $body -m 20 2>&1
    $elapsed = ((Get-Date) - $start).TotalSeconds
    if ($elapsed -gt 20) {
        $warnings += "⚠️  Timeout não respeitado: $elapsed segundos"
    }
} catch {
    # Esperado
}
Write-Host "   ✅ Timeout testado" -ForegroundColor Green

# Teste 4: Headers de Segurança
Write-Host "`n4. Testando headers de segurança..." -ForegroundColor Yellow
$body = @{ mint = "So11111111111111111111111111111111111111112" } | ConvertTo-Json -Compress
$r = curl.exe -sI "$base/api/scan" -H "Content-Type: application/json" -X POST --data-raw $body 2>&1
$headers = $r -join "`n"
if ($headers -notmatch "cache-control.*no-store") {
    $warnings += "⚠️  Falta header cache-control: no-store"
}
Write-Host "   ✅ Headers testados" -ForegroundColor Green

# Teste 5: CORS / OPTIONS
Write-Host "`n5. Testando CORS preflight..." -ForegroundColor Yellow
$r = curl.exe -sS -X OPTIONS "$base/api/scan" -H "Origin: https://evil.com" -H "Access-Control-Request-Method: POST" 2>&1
if ($r -match "access-control-allow-origin.*\*") {
    $warnings += "⚠️  CORS permite qualquer origem (*)"
}
Write-Host "   ✅ CORS testado" -ForegroundColor Green

# Teste 6: Error Information Disclosure
Write-Host "`n6. Testando vazamento de informações em erros..." -ForegroundColor Yellow
Remove-Item Env:\BAGS_SHIELD_API_BASE -ErrorAction SilentlyContinue
$body = @{ mint = "So11111111111111111111111111111111111111112" } | ConvertTo-Json -Compress
$r = curl.exe -sS "$base/api/scan" -H "Content-Type: application/json" --data-raw $body 2>&1
$o = $r | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($o -and $o.error -and ($o.error -match "stack|trace|at |Error:|Exception" -or $o.error -match "C:\\|/home/|/var/")) {
    $errors += "❌ Vazamento de informação sensível em erro: $($o.error)"
}
Write-Host "   ✅ Error disclosure testado" -ForegroundColor Green

# Teste 7: Content-Type validation
Write-Host "`n7. Testando validação de Content-Type..." -ForegroundColor Yellow
$body = @{ mint = "So11111111111111111111111111111111111111112" } | ConvertTo-Json -Compress
$r = curl.exe -sS "$base/api/scan" -H "Content-Type: text/html" --data-raw $body 2>&1
$o = $r | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($o -and $o.success -eq $true) {
    $warnings += "⚠️  Aceita Content-Type incorreto"
}
Write-Host "   ✅ Content-Type testado" -ForegroundColor Green

# Teste 8: Body muito grande (DoS)
Write-Host "`n8. Testando DoS com body muito grande..." -ForegroundColor Yellow
$largeBody = @{ mint = "A" * 10000 } | ConvertTo-Json -Compress
$start = Get-Date
try {
    $r = curl.exe -sS "$base/api/scan" -H "Content-Type: application/json" --data-raw $largeBody -m 10 2>&1
    $elapsed = ((Get-Date) - $start).TotalSeconds
    if ($elapsed -gt 5) {
        $warnings += "⚠️  Body muito grande causa lentidão: $elapsed segundos"
    }
} catch {
    # Esperado
}
Write-Host "   ✅ Body size testado" -ForegroundColor Green

# Teste 9: Múltiplas requisições simultâneas (Rate limiting)
Write-Host "`n9. Testando requisições simultâneas..." -ForegroundColor Yellow
$jobs = @()
for ($i = 0; $i -lt 10; $i++) {
    $body = @{ mint = "So11111111111111111111111111111111111111112" } | ConvertTo-Json -Compress
    $jobs += Start-Job -ScriptBlock {
        param($url, $body)
        curl.exe -sS $url -H "Content-Type: application/json" --data-raw $body 2>&1
    } -ArgumentList "$base/api/scan", $body
}
$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
$successCount = ($results | ConvertFrom-Json -ErrorAction SilentlyContinue | Where-Object { $_.success -eq $true }).Count
if ($successCount -eq 10) {
    $warnings += "⚠️  Sem rate limiting: todas as 10 requisições simultâneas passaram"
}
Write-Host "   ✅ Concorrência testada" -ForegroundColor Green

# Teste 10: SQL Injection / NoSQL Injection (se aplicável)
Write-Host "`n10. Testando injection attacks..." -ForegroundColor Yellow
$injections = @(
    @{ mint = "'; DROP TABLE users; --" },
    @{ mint = "{`$ne: null}" },
    @{ mint = "'; SELECT * FROM tokens; --" }
)
foreach ($inj in $injections) {
    $body = $inj | ConvertTo-Json -Compress
    $r = curl.exe -sS "$base/api/scan" -H "Content-Type: application/json" --data-raw $body 2>&1
    $o = $r | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($o -and $o.success -eq $true) {
        $errors += "❌ Injection aceito: $($inj.mint)"
    }
}
Write-Host "   ✅ Injection testado" -ForegroundColor Green

# Teste 11: Redirect SSRF (302 redirect para IP interno)
Write-Host "`n11. Testando SSRF via redirect (302)..." -ForegroundColor Yellow
# Simula backend que responde 302 para localhost
$env:BAGS_SHIELD_API_BASE = "https://httpstat.us/302?url=http://127.0.0.1"
$body = @{ mint = "So11111111111111111111111111111111111111112" } | ConvertTo-Json -Compress
try {
    $r = curl.exe -sS -L "$base/api/scan" -H "Content-Type: application/json" --data-raw $body -m 5 2>&1
    $o = $r | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($o -and $o.success -eq $true) {
        $warnings += "⚠️  SSRF via redirect: backend seguiu redirect para IP interno"
    }
} catch {
    # Esperado - deve bloquear
}
Write-Host "   ✅ Redirect SSRF testado" -ForegroundColor Green

# Teste 12: Origin null (CORS)
Write-Host "`n12. Testando CORS com Origin: null..." -ForegroundColor Yellow
$r = curl.exe -sS -X OPTIONS "$base/api/scan" -H "Origin: null" -H "Access-Control-Request-Method: POST" -v 2>&1
if ($r -match "access-control-allow-origin.*null") {
    $errors += "❌ CORS permite Origin: null (deve omitir header)"
} elseif ($r -notmatch "access-control-allow-origin") {
    Write-Host "   ✅ Origin null não retorna allow-origin (correto)" -ForegroundColor Green
} else {
    $warnings += "⚠️  Verificar comportamento de Origin: null"
}
Write-Host "   ✅ Origin null testado" -ForegroundColor Green

# Teste 13: Body gigante (1MB - espera 413)
Write-Host "`n13. Testando body muito grande (1MB - espera 413)..." -ForegroundColor Yellow
$largeMint = "A" * 1048576  # 1MB
$largeBody = @{ mint = $largeMint } | ConvertTo-Json -Compress
$start = Get-Date
try {
    $r = curl.exe -sS -w "%{http_code}" "$base/api/scan" -H "Content-Type: application/json" --data-raw $largeBody -m 10 2>&1
    $statusCode = ($r -split "`n" | Select-Object -Last 1)
    if ($statusCode -ne "413" -and $statusCode -ne "400") {
        $warnings += "⚠️  Body 1MB não retornou 413/400 (retornou: $statusCode)"
    } else {
        Write-Host "   ✅ Body 1MB rejeitado corretamente (status: $statusCode)" -ForegroundColor Green
    }
} catch {
    # Esperado
}
Write-Host "   ✅ Body size (1MB) testado" -ForegroundColor Green

# Teste 14: URL esquisita com userinfo trick
Write-Host "`n14. Testando SSRF via userinfo trick (example.com@169.254.169.254)..." -ForegroundColor Yellow
$trickUrls = @(
    "https://example.com@169.254.169.254/",
    "https://example.com@127.0.0.1/",
    "https://user:pass@192.168.1.1/"
)
foreach ($trickUrl in $trickUrls) {
    $env:BAGS_SHIELD_API_BASE = $trickUrl
    $body = @{ mint = "So11111111111111111111111111111111111111112" } | ConvertTo-Json -Compress
    try {
        $r = curl.exe -sS "$base/api/scan" -H "Content-Type: application/json" --data-raw $body -m 5 2>&1
        $o = $r | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($o -and $o.success -eq $true) {
            $errors += "❌ SSRF userinfo trick aceito: $trickUrl (deve pegar hostname final)"
        }
    } catch {
        # Esperado - deve bloquear
    }
}
Write-Host "   ✅ Userinfo trick testado" -ForegroundColor Green

# Resumo
Write-Host "`n=== RESUMO ===" -ForegroundColor Cyan
Write-Host ""

if ($errors.Count -gt 0) {
    Write-Host "ERROS ENCONTRADOS ($($errors.Count)):" -ForegroundColor Red
    foreach ($err in $errors) {
        Write-Host "  $err" -ForegroundColor Red
    }
} else {
    Write-Host "✅ Nenhum erro crítico encontrado" -ForegroundColor Green
}

Write-Host ""

if ($warnings.Count -gt 0) {
    Write-Host "AVISOS ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($warn in $warnings) {
        Write-Host "  $warn" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Nenhum aviso encontrado" -ForegroundColor Green
}

Write-Host ""

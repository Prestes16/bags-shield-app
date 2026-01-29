# Dev Clean Script - Limpa cache do Next.js para resolver erros de módulos faltando
# Uso: .\scripts\dev-clean.ps1
# IMPORTANTE: Pare o dev server antes de executar este script

param(
    [switch]$Force
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Next.js Dev Clean Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if dev server is running
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses -and -not $Force) {
    Write-Host "⚠️  AVISO: Processos Node.js detectados." -ForegroundColor Yellow
    Write-Host "   Pare o dev server (Ctrl+C) antes de continuar." -ForegroundColor Yellow
    Write-Host "   Ou use -Force para continuar mesmo assim." -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Continuar mesmo assim? (S/N)"
    if ($response -ne "S" -and $response -ne "s") {
        Write-Host "Cancelado." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "Limpando cache do Next.js..." -ForegroundColor Yellow

# Remove .next directory
if (Test-Path ".\.next") {
    Write-Host "  Removendo .next..." -ForegroundColor Gray
    Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue
    if (Test-Path ".\.next") {
        Write-Host "  ⚠️  Não foi possível remover .next completamente (pode estar em uso)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ .next removido" -ForegroundColor Green
    }
} else {
    Write-Host "  ✓ .next não existe (já limpo)" -ForegroundColor Green
}

# Remove .next/cache if exists separately
if (Test-Path ".\.next\cache") {
    Write-Host "  Removendo .next/cache..." -ForegroundColor Gray
    Remove-Item -Recurse -Force ".\.next\cache" -ErrorAction SilentlyContinue
    Write-Host "  ✓ .next/cache removido" -ForegroundColor Green
}

# Remove node_modules/.cache if exists
if (Test-Path ".\node_modules\.cache") {
    Write-Host "  Removendo node_modules/.cache..." -ForegroundColor Gray
    Remove-Item -Recurse -Force ".\node_modules\.cache" -ErrorAction SilentlyContinue
    Write-Host "  ✓ node_modules/.cache removido" -ForegroundColor Green
}

Write-Host ""
Write-Host "✓ Limpeza concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. npm run dev" -ForegroundColor White
Write-Host "  2. Verificar se /_next/static carrega sem 404" -ForegroundColor White
Write-Host ""

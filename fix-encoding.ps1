param(
  [string[]]$Targets = @(
    "src/components/webacy/WebacySignals.tsx",
    "src/app/scan/result/[mint]/page.tsx",
    "src/components/jupiter/JupiterSwap.tsx",
    ".github/workflows/ci.yml"
  )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# garante que roda a partir do root do repo (onde este arquivo está)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$enc = New-Object System.Text.UTF8Encoding($false)

foreach($t in $Targets){
  if(!(Test-Path -LiteralPath $t)){
    Write-Host "SKIP: $t (missing)" -ForegroundColor Yellow
    continue
  }

  $p = (Resolve-Path -LiteralPath $t).Path

  # lê como UTF-8 (se já estiver ok) e normaliza LF + UTF-8 sem BOM
  $content = Get-Content -Raw -LiteralPath $p -Encoding UTF8
  $content = $content -replace "`r`n","`n"
  if(-not $content.EndsWith("`n")){ $content += "`n" }

  [System.IO.File]::WriteAllText($p, $content, $enc)
  Write-Host "REWROTE: $t" -ForegroundColor Green
}

Write-Host "`nOK" -ForegroundColor Cyan

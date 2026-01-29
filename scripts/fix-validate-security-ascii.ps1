$ErrorActionPreference = "Stop"

function ReadUtf8([string]$p) { Get-Content -LiteralPath $p -Raw -Encoding UTF8 }
function WriteUtf8NoBom([string]$p, [string]$content) {
  $content = $content -replace "`r`n","`n"
  if (-not $content.EndsWith("`n")) { $content += "`n" }
  [System.IO.File]::WriteAllText((Resolve-Path $p).Path, $content, (New-Object System.Text.UTF8Encoding($false)))
}

$path = "validate-security.js"
if (-not (Test-Path $path)) { throw "Arquivo não encontrado: $path" }

$c = ReadUtf8 $path

# troca emojis por ASCII (mantém o texto legível)
$map = @(
  @{ f="✅"; t="[OK]" },
  @{ f="❌"; t="[FAIL]" },
  @{ f="⚠️"; t="[WARN]" },
  @{ f="ℹ️"; t="[i]" },
  @{ f="ℹ";  t="[i]" },
  @{ f="🧪"; t="" },
  @{ f="📦"; t="" },
  @{ f="📋"; t="" },
  @{ f="🎉"; t="" }
)

foreach ($m in $map) { $c = $c.Replace($m.f, $m.t) }

# limpa mojibake comum (quando já foi impresso / copiado quebrado)
$c = $c.Replace("ðŸ“¦","").Replace("ðŸ“‹","").Replace("ðŸŽ‰","")
$c = $c.Replace("âœ…","[OK]").Replace("âŒ","[FAIL]").Replace("â„¹ï¸","[i]")

WriteUtf8NoBom $path $c
Write-Host "OK: validate-security.js agora está ASCII-safe" -ForegroundColor Green

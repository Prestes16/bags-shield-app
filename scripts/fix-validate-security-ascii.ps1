param([string]$Path = "validate-security.js")

$ErrorActionPreference = "Stop"

function ReadUtf8([string]$p) { Get-Content -LiteralPath $p -Raw -Encoding UTF8 }
function WriteUtf8NoBom([string]$p, [string]$content) {
  $content = $content -replace "`r`n","`n"
  if (-not $content.EndsWith("`n")) { $content += "`n" }
  [System.IO.File]::WriteAllText((Resolve-Path $p).Path, $content, (New-Object System.Text.UTF8Encoding($false)))
}

if (-not (Test-Path $Path)) { throw "Arquivo nao encontrado: $Path" }

$c = ReadUtf8 $Path

# Remove QUALQUER caractere fora do ASCII imprimivel (mantem tab/newline/CR)
$c2 = [regex]::Replace($c, '[^\x09\x0A\x0D\x20-\x7E]', '')

# limpa espacos extras que podem sobrar onde tinha emoji
$c2 = [regex]::Replace($c2, '[ \t]+\n', "`n")

WriteUtf8NoBom $Path $c2
Write-Host ("OK: stripped non-ASCII from " + $Path) -ForegroundColor Green

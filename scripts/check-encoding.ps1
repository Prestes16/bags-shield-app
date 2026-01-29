param(
  [string]$Root = "src"
)

$bad = @("Ã", "â", "ðŸ")

$hits = @()
Get-ChildItem -Recurse -File $Root -Include *.ts, *.tsx, *.js, *.jsx, *.css, *.md | ForEach-Object {
  $p = $_.FullName
  $i = 0
  Get-Content -LiteralPath $p | ForEach-Object {
    $i++
    $line = $_
    foreach ($b in $bad) {
      if ($line -like "*$b*") {
        $hits += "{0}:{1}: {2}" -f $p, $i, $line.Trim()
        break
      }
    }
  }
}

if ($hits.Count -gt 0) {
  "ENCODING FAIL:"
  $hits | Select-Object -First 200
  exit 1
}

"ENCODING OK"

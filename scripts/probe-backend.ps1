param(
  [string[]]$Bases = @(
    "https://bags-shield-api.vercel.app",
    "https://bags-shield-api-cleiton-prestes-s-projects.vercel.app",
    "https://bags-shield-api.vercel.app/api", # caso alguém tenha colocado errado
    "http://localhost:3001"                  # se tiver backend local
  ),
  [string]$Mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
)

$paths = @("/api/scan", "/api/v0/scan", "/api/health", "/api/ping")

function Try-Json($url, $bodyJson) {
  try {
    $r = curl.exe -sS -D - -o - $url -H "Content-Type: application/json" --data-raw $bodyJson
    $hdr, $body = $r -split "(\r?\n){2}", 2
    $ct = ($hdr -split "`n" | Where-Object { $_ -match "^content-type:" } | Select-Object -First 1)
    $isJson = ($ct -match "application/json") -or ($body.TrimStart().StartsWith("{"))
    $isHtml = ($body -match "<!doctype|<html|<head|<body")
    return [pscustomobject]@{ ok=$isJson -and -not $isHtml; ct=$ct; body=$body; hdr=$hdr }
  } catch {
    return [pscustomobject]@{ ok=$false; ct=""; body=""; hdr="ERR: $($_.Exception.Message)" }
  }
}

$body = @{ mint=$Mint } | ConvertTo-Json -Compress

foreach ($b in $Bases) {
  $base = $b.TrimEnd("/")
  if ($base.EndsWith("/api")) { $base = $base.Substring(0, $base.Length-4) } # evita /api/api
  Write-Host "`n=== BASE: $base ==="
  foreach ($p in $paths) {
    if ($p -eq "/api/scan" -or $p -eq "/api/v0/scan") {
      $res = Try-Json "$base$p" $body
    } else {
      try {
        $txt = curl.exe -sS -D - -o - "$base$p"
        $res = [pscustomobject]@{ ok=($txt -match "200"); ct=""; body=""; hdr="(ping/health raw)" }
      } catch {
        $res = [pscustomobject]@{ ok=$false; ct=""; body=""; hdr="ERR: $($_.Exception.Message)" }
      }
    }

    $mark = if ($res.ok) { "[OK]" } else { "[..]" }
    Write-Host ("{0} {1}" -f $mark, $p)
    if ($res.ok -and ($p -eq "/api/scan" -or $p -eq "/api/v0/scan")) {
      Write-Host "  -> JSON parece válido (sem HTML). Base candidata encontrada!"
      Write-Host "  -> Sugestão .env.local: BAGS_SHIELD_API_BASE=$base"
      exit 0
    }
  }
}

Write-Host "`nNenhuma base respondeu JSON em /api/scan ou /api/v0/scan."
Write-Host "Isso confirma o que o arquivo diz: o domínio alvo não está com as rotas publicadas."
exit 1

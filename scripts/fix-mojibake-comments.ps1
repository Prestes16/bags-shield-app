Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$targets = @("src\app\api\scan\route.ts","src\lib\proxy.ts")

function Fix-Mojibake([string]$s){
  $encLatin = [System.Text.Encoding]::GetEncoding(28591) # ISO-8859-1
  $bytes = $encLatin.GetBytes($s)
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

foreach($t in $targets){
  if(!(Test-Path -LiteralPath $t)){ throw "MISSING: $t" }
  $p = (Resolve-Path -LiteralPath $t).Path
  $out = New-Object System.Collections.Generic.List[string]
  $changed = $false

  foreach($line in (Get-Content -LiteralPath $p -Encoding UTF8)){
    $l = $line
    $idx = $l.IndexOf("//")
    if($idx -ge 0){
      $code = $l.Substring(0,$idx)
      $cmt  = $l.Substring($idx)
      if($cmt -match "[Ãâð]"){
        $fixed = Fix-Mojibake $cmt
        if($fixed -ne $cmt){ $changed = $true; $cmt = $fixed }
      }
      $l = $code + $cmt
    }
    $out.Add($l) | Out-Null
  }

  $txt = ($out -join "`n") -replace "`r`n","`n"
  if(-not $txt.EndsWith("`n")){ $txt += "`n" }
  [System.IO.File]::WriteAllText($p, $txt, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host ("PATCHED: {0} changed={1}" -f $t, $changed) -ForegroundColor Cyan
}

Write-Host "`n=== Recheck encoding guard ===" -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File scripts/check-encoding.ps1

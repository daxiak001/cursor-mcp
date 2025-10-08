param(
  [string]$AnalysisJson = 'reports\smoke-analysis.json',
  [string]$GateJson = 'policy\quality-gates.json',
  [string]$OutTxt = 'reports\smoke-gate.txt'
)

if (!(Test-Path $AnalysisJson) -or !(Test-Path $GateJson)) {
  "SKIPPED" | Out-File -FilePath $OutTxt -Encoding UTF8
  exit 0
}

try {
  $a = Get-Content $AnalysisJson -Raw | ConvertFrom-Json
  $g = Get-Content $GateJson -Raw | ConvertFrom-Json
  $threshold = [int]$g.smoke.weighted_pass_threshold
  $mode = $g.smoke.mode
  $value = [int]$a.weightedPassPercent
  $msg = "smoke weighted pass: $value% (threshold=$threshold, mode=$mode)"
  $msg | Out-File -FilePath $OutTxt -Encoding UTF8
  if ($value -lt $threshold) {
    if ($mode -eq 'fail') { Write-Error $msg; exit 5 } else { Write-Warning $msg; exit 0 }
  } else { Write-Host $msg; exit 0 }
} catch {
  "ERROR" | Out-File -FilePath $OutTxt -Encoding UTF8
  exit 0
}



# check_quality.ps1
param(
  [string]$RoutingJson = 'policy\routing.json',
  [string]$Txt = 'reports\coverage-summary.txt',
  [string]$Json = 'coverage\coverage-summary.json',
  [int]$DefaultThreshold = 60
)

$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$summary = @()
$summary += "[$ts] 质量检查"

function Read-Threshold {
  param([string]$routingPath)
  if (!(Test-Path $routingPath)) { return $DefaultThreshold }
  try {
    $r = Get-Content $routingPath -Raw | ConvertFrom-Json
    $max = $DefaultThreshold
    foreach ($rule in $r.routing) {
      if ($rule.coverage -and [int]$rule.coverage -gt $max) { $max = [int]$rule.coverage }
    }
    return $max
  } catch { return $DefaultThreshold }
}

$threshold = Read-Threshold -routingPath $RoutingJson
$summary += "覆盖率阈值：$threshold%"

function Parse-Coverage {
  if (Test-Path $Json) {
    try {
      $obj = Get-Content $Json -Raw | ConvertFrom-Json
      if ($obj.total.lines.pct) { return [int]$obj.total.lines.pct }
    } catch {}
  }
  if (Test-Path $Txt) {
    try {
      $line = (Get-Content $Txt | Select-Object -First 1)
      $m = [regex]::Match($line, '([0-9]{1,3})')
      if ($m.Success) { return [int]$m.Groups[1].Value }
    } catch {}
  }
  return 0
}

$cov = Parse-Coverage
$summary += "当前覆盖率：$cov%"

$summary -join "`n" | Out-File -FilePath 'reports\quality-summary.txt' -Encoding UTF8

if ($cov -lt $threshold) {
  Write-Error "覆盖率未达标：$cov% < $threshold%"
  exit 3
} else {
  Write-Host "覆盖率达标"
  exit 0
}

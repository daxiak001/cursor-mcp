# check_quality.ps1
param(
  [string]$RoutingJson = 'policy\routing.json',
  [string]$DomainThresholds = 'policy\domain-thresholds.json',
  [string]$Txt = 'reports\coverage-summary.txt',
  [string]$Json = 'coverage\coverage-summary.json',
  [int]$DefaultThreshold = 60,
  [string]$ChangedFiles = 'reports\changed-files.txt',
  [string]$AffectedDomains = 'reports\affected-domains.txt'
)

$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$summary = @()
$summary += "[$ts] 质量检查"

function Read-Threshold {
  param([string]$routingPath, [string[]]$changed)
  if (!(Test-Path $routingPath)) { return $DefaultThreshold }
  try {
    $r = Get-Content $routingPath -Raw | ConvertFrom-Json
    $max = $DefaultThreshold
    $routes = @($r.routing)
    if ($changed -and $changed.Count -gt 0) {
      foreach ($f in $changed) {
        foreach ($rule in $routes) {
          if ($rule.path -and $rule.coverage) {
            $glob = $rule.path.Replace('**','')
            if ($f -like $glob -or $f -like $rule.path) {
              if ([int]$rule.coverage -gt $max) { $max = [int]$rule.coverage }
            }
          }
        }
      }
    } else {
      foreach ($rule in $routes) {
        if ($rule.coverage -and [int]$rule.coverage -gt $max) { $max = [int]$rule.coverage }
      }
    }
    return $max
  } catch { return $DefaultThreshold }
}

$changed = @()
if (Test-Path $ChangedFiles) {
  try { $changed = Get-Content $ChangedFiles | Where-Object { $_ } } catch {}
}
$domainMax = -1
if ((Test-Path $AffectedDomains) -and (Test-Path $DomainThresholds)) {
  try {
    $domains = (Get-Content $AffectedDomains -Raw).Split(',') | Where-Object { $_ }
    $conf = Get-Content $DomainThresholds -Raw | ConvertFrom-Json
    foreach ($d in $domains) {
      $v = $conf.thresholds.$d
      if ($v -and [int]$v -gt $domainMax) { $domainMax = [int]$v }
    }
    if ($domainMax -lt 0 -and $conf.thresholds.default) { $domainMax = [int]$conf.thresholds.default }
  } catch {}
}

$routeMax = Read-Threshold -routingPath $RoutingJson -changed $changed
$threshold = if ($domainMax -gt $routeMax) { $domainMax } else { $routeMax }
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

param(
  [string]$File = 'policy\exceptions.json',
  [string]$Out = 'reports\expiry-report.md',
  [switch]$AutoClean
)

$items = @()
if (Test-Path $File) {
  try { $items = (Get-Content $File -Raw | ConvertFrom-Json).exceptions } catch {}
}

$now = Get-Date
$expired = @()
$active = @()
foreach ($e in $items) {
  $dt = $null
  if ([DateTime]::TryParse($e.expires, [ref]$dt)) {
    if ($dt -lt $now) { $expired += $e } else { $active += $e }
  } else { $active += $e }
}

if (!(Test-Path 'reports')) { New-Item -ItemType Directory -Path 'reports' | Out-Null }
$lines = @('# Exceptions Expiry','')
$lines += ("- expired: {0}" -f $expired.Count)
$lines += ("- active: {0}" -f $active.Count)
foreach ($x in $expired) { $lines += ("  - {0} rules=[{1}] expired={2}" -f $x.path, ($x.rules -join ', '), $x.expires) }

if ($AutoClean -and $expired.Count -gt 0) {
  $new = @{ exceptions = @() }
  foreach ($a in $active) { $new.exceptions += $a }
  ($new | ConvertTo-Json -Depth 6) | Out-File -FilePath $File -Encoding UTF8
}

$lines -join "`n" | Out-File -FilePath $Out -Encoding UTF8
Write-Host 'expiry report generated'








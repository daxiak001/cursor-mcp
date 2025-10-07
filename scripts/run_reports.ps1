# run_reports.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/preflight.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/check_quality.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/export_coverage.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/policy_report.ps1

$dashboard = @()
$dashboard += "# CI Dashboard"
$dashboard += ""
$dashboard += "## Artifacts"
if (Test-Path 'reports/coverage-summary.txt') { $dashboard += "- coverage-summary.txt" }
if (Test-Path 'coverage/coverage-summary.json') { $dashboard += "- coverage/coverage-summary.json" }
if (Test-Path 'reports/quality-summary.txt') { $dashboard += "- quality-summary.txt" }
if (Test-Path 'reports/diff-test-pattern.txt') { $dashboard += "- diff-test-pattern.txt" }
if (Test-Path 'reports/changed-files.txt') { $dashboard += "- changed-files.txt" }
if (Test-Path 'reports/tests-to-run.txt') { $dashboard += "- tests-to-run.txt" }
if (Test-Path 'reports/affected-domains.txt') { $dashboard += "- affected-domains.txt" }
if (Test-Path 'reports/tests-to-run-augmented.txt') { $dashboard += "- tests-to-run-augmented.txt" }
if (Test-Path 'reports/domain-smoke-created.txt') { $dashboard += "- domain-smoke-created.txt" }
if (Test-Path 'reports/policy-report.md') { $dashboard += "- policy-report.md" }
if (Test-Path 'reports/interface-diff.md') { $dashboard += "- interface-diff.md" }
if (Test-Path 'reports/contract-check.md') { $dashboard += "- contract-check.md" }
if (Test-Path 'reports/expiry-report.md') { $dashboard += "- expiry-report.md" }
if (Test-Path 'reports/smoke-analysis.md') { $dashboard += "- smoke-analysis.md" }
if (!(Test-Path 'reports')) { New-Item -ItemType Directory -Path 'reports' | Out-Null }
$dashboard -join "`n" | Out-File -FilePath 'reports/ci-dashboard.md' -Encoding UTF8

# Interface Diff Summary
$iface = @()
if (Test-Path 'reports/interface-diff.json') {
  try { $iface = Get-Content 'reports/interface-diff.json' -Raw | ConvertFrom-Json } catch {}
}

$missingTotal = 0
$extraTotal = 0
foreach ($d in $iface) {
  if ($null -ne $d.missing) { $missingTotal += $d.missing.Count }
  if ($null -ne $d.extra) { $extraTotal += $d.extra.Count }
}

$summary = @()
$summary += ""
$summary += "## Interface Diff Summary"
$summary += ("- modules with diffs: {0}" -f $iface.Count)
$summary += ("- missing symbols: {0}" -f $missingTotal)
$summary += ("- extra symbols: {0}" -f $extraTotal)
foreach ($d in ($iface | Select-Object -First 5)) {
  $summary += ("  - {0} | missing: {1} | extra: {2}" -f $d.module, (($d.missing -join ', ')), (($d.extra -join ', ')))
}
(Get-Content 'reports/ci-dashboard.md' -Raw) + "`n" + ($summary -join "`n") | Out-File -FilePath 'reports/ci-dashboard.md' -Encoding UTF8

# Domain Smoke Summary
$smokeCount = 0
if (Test-Path 'reports/domain-smoke-created.txt') {
  try { $smokeCount = [int](Get-Content 'reports/domain-smoke-created.txt' -Raw) } catch {}
}
$smoke = @()
$smoke += ""
$smoke += "## Domain Smoke Summary"
$smoke += ("- newly created smoke tests: {0}" -f $smokeCount)
(try {
  $domConf = Get-Content 'policy/domains.json' -Raw | ConvertFrom-Json
  $arr = @()
  foreach ($d in $domConf.domains) { $arr += [PSCustomObject]@{ name=$d.name; weight=([int]($d.weight ? $d.weight : 0)) } }
  $arr = $arr | Sort-Object -Property weight -Descending
  $smoke += "- smoke priority (by weight):"
  foreach ($i in $arr) { $smoke += ("  - {0} (w={1})" -f $i.name, $i.weight) }
} catch { $smoke += "- smoke priority: (domains.json missing)" })
(Get-Content 'reports/ci-dashboard.md' -Raw) + "`n" + ($smoke -join "`n") | Out-File -FilePath 'reports/ci-dashboard.md' -Encoding UTF8

# Smoke Weighted Summary
try {
  if (Test-Path 'reports/smoke-analysis.json') {
    $obj = Get-Content 'reports/smoke-analysis.json' -Raw | ConvertFrom-Json
    $lines = @()
    $lines += ""
    $lines += "## Smoke Weighted Summary"
    $lines += ("- weighted pass: {0}% ({1}/{2})" -f $obj.weightedPassPercent, $obj.passedWeight, $obj.totalWeight)
    foreach ($e in ($obj.entries | Sort-Object -Property weight -Descending | Select-Object -First 5)) {
      $lines += ("  - {0} (w={1}): {2}" -f $e.name, $e.weight, $e.status)
    }
    (Get-Content 'reports/ci-dashboard.md' -Raw) + "`n" + ($lines -join "`n") | Out-File -FilePath 'reports/ci-dashboard.md' -Encoding UTF8
  }
} catch {}

# Smoke Gate Summary
if (Test-Path 'reports/smoke-gate.txt') {
  $gate = Get-Content 'reports/smoke-gate.txt' -Raw
  (Get-Content 'reports/ci-dashboard.md' -Raw) + "`n## Smoke Gate`n- $gate" | Out-File -FilePath 'reports/ci-dashboard.md' -Encoding UTF8
}

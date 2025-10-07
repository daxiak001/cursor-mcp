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
(Get-Content 'reports/ci-dashboard.md' -Raw) + "`n" + ($smoke -join "`n") | Out-File -FilePath 'reports/ci-dashboard.md' -Encoding UTF8

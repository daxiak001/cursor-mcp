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
if (Test-Path 'reports/policy-report.md') { $dashboard += "- policy-report.md" }
if (!(Test-Path 'reports')) { New-Item -ItemType Directory -Path 'reports' | Out-Null }
$dashboard -join "`n" | Out-File -FilePath 'reports/ci-dashboard.md' -Encoding UTF8

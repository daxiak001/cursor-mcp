# run_reports.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/preflight.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/check_quality.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/export_coverage.ps1

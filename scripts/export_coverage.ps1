# export_coverage.ps1
param(
  [string]$Out = 'reports/coverage-summary.txt'
)
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
"[$ts] 覆盖率汇总（示例占位）" | Out-File -FilePath $Out -Encoding UTF8
"core: 81%" | Add-Content -Path $Out
"general: 65%" | Add-Content -Path $Out

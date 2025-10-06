# check_quality.ps1
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$summary = @()
$summary += "[$ts] 质量检查（示例占位）"
$summary += "覆盖率阈值：core=80 general=60"
$summary += "SAST：未实际执行（需本机安装semgrep）"
$summary += "Secrets：未实际执行（需本机安装gitleaks）"
$summary -join "`n" | Out-File -FilePath 'reports\quality-summary.txt' -Encoding UTF8

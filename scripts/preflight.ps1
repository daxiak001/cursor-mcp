# preflight.ps1
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$lines = @()
$lines += "[$ts] 预检（占位）："
$lines += "- Node/npm: 未检测（需本机安装）"
$lines += "- Python/pytest: 未检测（可选）"
$lines += "- semgrep/gitleaks: 未检测（可选）"
$lines += "- hooks绑定: 可执行 scripts/setup.ps1"
$lines -join "`n" | Out-File -FilePath 'reports\preflight_placeholder.txt' -Encoding UTF8

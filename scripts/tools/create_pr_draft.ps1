param(
  [string]$Base = 'main',
  [string]$Head = '',
  [string]$Repo = 'daxiak001/cursor-mcp'
)

if (-not $Head) {
  $Head = (git rev-parse --abbrev-ref HEAD)
}

$url = "https://github.com/$Repo/compare/$Base...$Head?expand=1&title=$([uri]::EscapeDataString($Head))&body=$([uri]::EscapeDataString((Get-Content 'reports/pr_body.md' -Raw -ErrorAction SilentlyContinue)))"
Write-Host "Open PR draft:" -ForegroundColor Cyan
Write-Host $url
if (!(Test-Path 'reports')) { New-Item -ItemType Directory -Path 'reports' | Out-Null }
Set-Content -Path 'reports/pr_link.txt' -Value $url -Encoding UTF8


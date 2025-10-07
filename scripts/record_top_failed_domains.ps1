param(
  [string]$AnalysisJson = 'reports\smoke-analysis.json',
  [string]$OutMd = 'reports\smoke-top-failed.md',
  [string]$IssuesDir = '问题处理'
)

if (!(Test-Path $AnalysisJson)) { exit 0 }
try {
  $a = Get-Content $AnalysisJson -Raw | ConvertFrom-Json
  $lines = @()
  $lines += "# Smoke Top Failed Domains"
  foreach ($e in $a.topFailed) { $lines += ("- {0} (w={1})" -f $e.name, $e.weight) }
  if (!(Test-Path 'reports')) { New-Item -ItemType Directory -Path 'reports' | Out-Null }
  $lines -join "`n" | Out-File -FilePath $OutMd -Encoding UTF8
  if (!(Test-Path $IssuesDir)) { New-Item -ItemType Directory -Path $IssuesDir | Out-Null }
  $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
  $issueFile = Join-Path $IssuesDir ("SMOKE-TOP-FAILED-" + $ts + ".md")
  $lines -join "`n" | Out-File -FilePath $issueFile -Encoding UTF8
} catch {}



# hardcode_scan.ps1
param(
  [string[]]$Paths = @('src','config'),
  [string]$PatternFile = 'mcp\tools\_patterns.hardcode.txt',
  [string]$OutFile = 'reports\hardcode-scan.txt'
)

$ErrorActionPreference = 'Continue'
if (!(Test-Path $PatternFile)) {
  Write-Host "找不到模式文件: $PatternFile"
  exit 1
}

$patterns = Get-Content -Path $PatternFile | Where-Object { $_ -and ($_.Trim().Length -gt 0) -and (-not $_.Trim().StartsWith('#')) }
$files = @()
foreach ($p in $Paths) {
  if (Test-Path $p) {
    $files += Get-ChildItem -Path $p -Recurse -Include *.ts,*.js,*.json -File -ErrorAction SilentlyContinue
  }
}

$report = @()
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$report += "[$ts] 硬编码扫描报告"
$report += "模式文件: $PatternFile"
$report += "扫描目录: $($Paths -join ', ')"

if ($files.Count -eq 0) {
  $report += "未找到可扫描文件"
  $report -join "`n" | Out-File -FilePath $OutFile -Encoding UTF8
  Write-Host "无文件可扫描"
  exit 0
}

$matches = @()
foreach ($pat in $patterns) {
  try {
    $results = Select-String -Path ($files | ForEach-Object { $_.FullName }) -Pattern $pat -AllMatches -CaseSensitive:$false -ErrorAction SilentlyContinue
    foreach ($r in $results) {
      $line = $r.Line
      $line = if ($line.Length -gt 200) { $line.Substring(0,200) } else { $line }
      $matches += "${($r.Path)}:${($r.LineNumber)} | pattern: $pat | line: $line"
    }
  } catch {
    # 忽略模式错误
  }
}

if ($matches.Count -gt 0) {
  $report += "发现疑似硬编码：$($matches.Count) 处"
  $report += "---"
  $report += $matches
} else {
  $report += "未发现疑似硬编码"
}

$report -join "`n" | Out-File -FilePath $OutFile -Encoding UTF8
Write-Host "报告已生成: $OutFile"

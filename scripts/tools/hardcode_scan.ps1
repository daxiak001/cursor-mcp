# hardcode_scan.ps1
param(
  [string[]]$Paths = @('src','config'),
  [string]$PatternFile = 'mcp\tools\_patterns.hardcode.txt',
  [string]$OutFile = 'reports\hardcode-scan.txt',
  [string]$ExceptionsJson = 'policy\exceptions.json'
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

$rawMatches = @()
foreach ($pat in $patterns) {
  try {
    $results = Select-String -Path ($files | ForEach-Object { $_.FullName }) -Pattern $pat -AllMatches -CaseSensitive:$false -ErrorAction SilentlyContinue
    foreach ($r in $results) {
      $line = $r.Line
      if ($line.Length -gt 200) { $line = $line.Substring(0,200) }
      $rawMatches += [PSCustomObject]@{ Path=$r.Path; Line=$r.LineNumber; Pattern=$pat; Snippet=$line }
    }
  } catch { }
}

# 读取例外
$exceptMap = @{}
if (Test-Path $ExceptionsJson) {
  try {
    $json = Get-Content $ExceptionsJson -Raw | ConvertFrom-Json
    foreach ($e in ($json.exceptions | ForEach-Object { $_ })) {
      if ($null -ne $e -and $e.path -and $e.rules) {
        foreach ($rule in $e.rules) { $key = "$($e.path)|$rule"; $exceptMap[$key] = 1 }
      }
    }
  } catch { }
}

# 过滤例外（仅IR-003）
$matches = @()
foreach ($m in $rawMatches) {
  $allow = $false
  foreach ($k in $exceptMap.Keys) {
    $parts = $k -split '\|'
    if ($parts.Count -ge 2) {
      $p = $parts[0]; $rule = $parts[1]
      if ($rule -eq 'IR-003' -and $m.Path -like $p) { $allow = $true; break }
    }
  }
  if (-not $allow) { $matches += $m }
}

if ($matches.Count -gt 0) {
  $report += "发现疑似硬编码：$($matches.Count) 处"
  $report += "---"
  $report += ($matches | ForEach-Object { "${($_.Path)}:${($_.Line)} | pattern: ${($_.Pattern)} | line: ${($_.Snippet)}" })
} else {
  $report += "未发现疑似硬编码"
}

$report -join "`n" | Out-File -FilePath $OutFile -Encoding UTF8

if ($matches.Count -gt 0) { Write-Error '硬编码门禁未通过'; exit 2 } else { Write-Host '硬编码门禁通过'; exit 0 }

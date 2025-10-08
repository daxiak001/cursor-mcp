# archive_remaining.ps1
# 用途：继续搬移根目录剩余被占用项（重试），更新归档索引
param(
  [string]$Root = '..'
)
$ErrorActionPreference = 'Continue'
$archive = Join-Path $Root '【材料归档】'
$project = Join-Path $Root '【项目】开发材料'
$index = Join-Path $archive '归档索引.md'

$items = Get-ChildItem -LiteralPath $Root -Force | Where-Object { $_.Name -ne '【材料归档】' -and $_.Name -ne '【项目】开发材料' -and $_.Name -ne '【材料清单】.md' }
foreach ($it in $items) {
  try {
    Move-Item -LiteralPath $it.FullName -Destination $archive -Force
    Add-Content -Path $index -Value ("- " + $it.Name)
  } catch {
    Write-Host "跳过占用项: $($it.Name)"
  }
}

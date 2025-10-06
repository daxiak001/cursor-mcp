param(
  [string]$Routing = 'policy\routing.json',
  [string]$Changed = 'reports\changed-files.txt',
  [string]$OutJson = 'reports\policy-report.json',
  [string]$OutMd = 'reports\policy-report.md'
)

$routes = @()
if (Test-Path $Routing) {
  try { $routes = (Get-Content $Routing -Raw | ConvertFrom-Json).routing } catch {}
}

$changed = @()
if (Test-Path $Changed) {
  try { $changed = Get-Content $Changed | Where-Object { $_ } } catch {}
}

$match = @()
foreach ($f in $changed) {
  foreach ($r in $routes) {
    if ($r.path) {
      $p = $r.path
      $pNoStarStar = $p -replace '\*\*',''
      if ($f -like $p -or $f -like $pNoStarStar) {
        $match += [pscustomobject]@{ file=$f; route=$r.path; coverage=$r.coverage; apply=$r.apply }
      }
    }
  }
}

if (!(Test-Path 'reports')) { New-Item -ItemType Directory -Path 'reports' | Out-Null }
($match | ConvertTo-Json -Depth 6) | Out-File -FilePath $OutJson -Encoding UTF8

$md = @('# Policy Report','')
foreach ($m in $match) {
  $line = ('- `"{0}`" -> route: `"{1}`" | coverage: {2} | apply: {3}' -f $m.file, $m.route, $m.coverage, ($m.apply -join ', '))
  $md += $line
}
$mdText = $md -join "`n"
$mdText | Out-File -FilePath $OutMd -Encoding UTF8
Write-Host 'policy report generated'


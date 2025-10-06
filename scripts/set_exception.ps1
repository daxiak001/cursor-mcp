param(
  [Parameter(Mandatory=$true)][string]$Path,
  [Parameter(Mandatory=$true)][string[]]$Rules,
  [string]$Expires='2025-12-31',
  [string]$File='policy\exceptions.json'
)

if (!(Test-Path $File)) {
  $init = @{ exceptions = @() } | ConvertTo-Json -Depth 3
  $init | Out-File -FilePath $File -Encoding UTF8
}

$json = Get-Content $File -Raw | ConvertFrom-Json
if ($null -eq $json.exceptions) { $json | Add-Member -MemberType NoteProperty -Name exceptions -Value @() }

$updated = $false
for ($i=0; $i -lt $json.exceptions.Count; $i++) {
  $e = $json.exceptions[$i]
  if ($e.path -eq $Path) {
    $e.rules = $Rules
    $e.expires = $Expires
    $json.exceptions[$i] = $e
    $updated = $true
    break
  }
}
if (-not $updated) {
  $json.exceptions += [pscustomobject]@{ path=$Path; rules=$Rules; expires=$Expires }
}

($json | ConvertTo-Json -Depth 5) | Out-File -FilePath $File -Encoding UTF8
Write-Host "例外已更新: $Path -> rules=[$($Rules -join ',')] expires=$Expires"


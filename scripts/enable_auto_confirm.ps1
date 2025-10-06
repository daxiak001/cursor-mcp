param(
  [string]$Entry = ''
)

$node = $env:ProgramFiles + "\nodejs\node.exe"
if (-not (Test-Path $node)) { $node = 'node' }

$args = @('tools/update-cursor-settings.js', '--auto-confirm', 'true')
if ($Entry) { $args += @('--entry', $Entry) }

node @args
Write-Host "Auto-confirm enabled. Restart Cursor to take effect." -ForegroundColor Green



param(
  [string]$Entry = ''
)

$node = $env:ProgramFiles + "\nodejs\node.exe"
if (-not (Test-Path $node)) { $node = 'node' }

$args = @('tools/update-cursor-settings.js', '--auto-confirm', 'false')
if ($Entry) { $args += @('--entry', $Entry) }

node @args
Write-Host "Auto-confirm disabled. Restart Cursor to take effect." -ForegroundColor Yellow

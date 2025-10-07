param(
  [string]$Entry = $env:XIAOLIU_MCP_ENTRY,
  [string]$Cwd = $env:XIAOLIU_MCP_CWD,
  [string]$Name = 'xiaoliu-mcp-guardian',
  [string]$EnvFile = ''
)

$args = @('tools/update-cursor-settings.js', '--auto-confirm', 'true', '--name', $Name)
if ($Entry) { $args += @('--entry', $Entry) }
if ($Cwd) { $args += @('--cwd', $Cwd) }
if ($EnvFile) { $args += @('--env-file', $EnvFile) }

node @args
Write-Host "MCP enabled for $Name" -ForegroundColor Green



param(
  [string]$Name = 'xiaoliu-mcp-guardian'
)

node tools/update-cursor-settings.js --disable true --name $Name
Write-Host "MCP disabled for $Name" -ForegroundColor Yellow



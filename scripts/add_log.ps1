# add_log.ps1
param(
  [Parameter(Mandatory=$true)][string]$Type,  # TASK|TEST|NOTE|DECISION|BLOCK|STAGE
  [Parameter(Mandatory=$true)][string]$Message,
  [string]$Evidence
)
$now=(Get-Date -Format 'yyyy-MM-dd HH:mm');
$line="[#$Type] $now | 窗口A | $Message";
if ($Evidence) { $line+=" | 证据: $Evidence" }
Add-Content -Path '开发跟进记录.md' -Value $line

# add_stage.ps1
param(
  [Parameter(Mandatory=$true)][string]$StageId,
  [Parameter(Mandatory=$true)][string]$Summary,
  [string]$Deliverables,
  [string]$Evidence
)
$now=(Get-Date -Format 'yyyy-MM-dd HH:mm');
$line="[#STAGE] $now | $StageId | $Summary | $Deliverables | $Evidence";
Add-Content -Path '阶段登记表.md' -Value $line

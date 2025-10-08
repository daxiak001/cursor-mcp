# new_issue.ps1
param(
  [Parameter(Mandatory=$true)][string]$Id,
  [Parameter(Mandatory=$true)][string]$Summary
)
$fn = Join-Path '问题处理' ("$Id.md");
@"# 问题记录：$Id

概述：$Summary
(其余字段参见 问题记录模板.md )
"@ | Out-File -FilePath $fn -Encoding UTF8

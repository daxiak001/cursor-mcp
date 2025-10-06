# dev_cycle.ps1
# 单窗口开发周期占位：索引→执行卡→mcp→测试→登记→阶段
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$log = "[DEV_CYCLE] $ts | 单窗口周期执行占位";
Add-Content -Path 'reports\dev_cycle.txt' -Value $log

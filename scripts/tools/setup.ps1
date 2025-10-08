# setup.ps1
# 用途：一次性初始化（配置hooksPath、放行脚本执行）
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
try { git config core.hooksPath hooks } catch { Write-Host 'Git未配置或非仓库目录，可忽略' }

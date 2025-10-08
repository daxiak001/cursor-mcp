# generate_pr_body.ps1
param(
  [string]$Title = "docs: bootstrap",
  [string]$Out = 'reports/pr_body.md'
)
$body = @()
$body += "# PR 说明"
$body += "\n标题：$Title"
$body += "\n\n做了什么：初始化项目材料与脚本"
$body += "\n为什么这么做：建立可持续的单窗口执行与强制规则体系"
$body += "\n影响范围：文档/脚本/配置"
$body += "\n回滚策略：参考 回滚策略模板.md"
$body += "\n关联登记：开发跟进记录.md、阶段登记表.md"
$body -join "`n" | Out-File -FilePath $Out -Encoding UTF8

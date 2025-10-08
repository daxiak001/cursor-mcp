# dashboard

- 时间：已更新
- 最近[#TASK]：交付打包完成 → deliverable_2025-10-07_001711.zip
- 最近[#TEST]：预检/质量检查占位已执行 → reports/preflight_placeholder.txt, reports/quality-summary.txt
- 最近[#STAGE]：S3 已完成（VDCP演示覆盖率81%）
- 质量摘要：reports/quality-summary.txt
- 预检：reports/preflight_placeholder.txt
- 周期：reports/dev_cycle.txt

下一步建议：
- 本地：scripts/setup.ps1 → npm ci → npm run ci:all（或按步执行 test/接口/契约/冒烟/汇总）
- 远端：按“分支与PR指南.md”发起演示PR，使用“PR说明模板.md”
\n- 最新PR: https://github.com/daxiak001/cursor-mcp/pull/1
\n- 最近合并: PR#1 (https://github.com/daxiak001/cursor-mcp/pull/1)
\n- 最近合并: PR#2 (https://github.com/daxiak001/cursor-mcp/pull/2)
\n- 打开的PR: https://github.com/daxiak001/cursor-mcp/pull/3
\n- 最近合并: PR#3 (https://github.com/daxiak001/cursor-mcp/pull/3)
\n- 最近合并: PR#4 (https://github.com/daxiak001/cursor-mcp/pull/4)
\n- 最近合并: PR#5 (https://github.com/daxiak001/cursor-mcp/pull/5)
\n- 改表即用演示PR: https://github.com/daxiak001/cursor-mcp/pull/6
\n- 最近合并: PR#6 (https://github.com/daxiak001/cursor-mcp/pull/6)
\n- 打开的PR: https://github.com/daxiak001/cursor-mcp/pull/7
\n- 最近合并: PR#7 (https://github.com/daxiak001/cursor-mcp/pull/7)
\n- 最近合并: PR#8 (https://github.com/daxiak001/cursor-mcp/pull/8)

- 最新发布: v0.1.0 (https://github.com/daxiak001/cursor-mcp/releases/tag/v0.1.0)

- 最近合并: PR#9, PR#10

- v0.2 启动项已合并（分层路由+AST insert_import）

- 差异选测已接入（CI）

- v0.2 安全门禁配置已提交（PR模板、Semgrep、Gitleaks）

- 安全工作流已就绪（独立security.yml），PR模板已加入

- AST补丁工具增强：add_function/update_call_argument 已提交

- v0.3：例外管理与动态阈值开发中（已提交部分）

- v0.3 动态阈值与例外脚本提交，CI工件含changed-files

- v0.3.0 阶段合并完成（未打tag）

- v0.4 AST操作新增：insert_param/add_guard_clause（含demo+tests）

- v0.4.0 合并完成（AST: insert_param/add_guard_clause）
 
 - v0.5：高级差异选测（tests-to-run）与策略报告（policy-report.{json,md}）已提交到分支

- v0.5.0 已合并：高级选测与策略报告

- CI Dashboard（reports/ci-dashboard.md）已生成并纳入工件

- v0.6：接口差异报告已接入（interface-diff.{json,md}）

- CI汇总接口差异（非阻断），见 reports/ci-dashboard.md

- v0.7：契约校验（非阻断）与例外到期报告已接入

- v0.7.0 已合并：契约校验（非阻断）与例外到期报告

- v0.8：受影响域（affected-domains.{txt,json}）已接入CI

- v0.8.0 已合并：受影响域工件(affected-domains.{txt,json})
- v0.9.0 已交付：域阈值+增强选测（tests-to-run-augmented），新增交付文档（Delivery Summary、Completion Checklist、Three-Stage Master Plan）

- v0.9：域阈值(domain-thresholds)与增强选测(tests-to-run-augmented)已接入

- v0.9.0 已合并：域阈值与增强选测工件(tests-to-run-augmented)

- v0.9.1 已合并：自动确认模式（enable/disable脚本+环境变量）

- v0.9.2 已合并：PR模板/Issue模板/PR草稿脚本

- v1.0.0 发布完成：发布说明与交付摘要已更新

- v1.0.0 已合并到 main

- v1.1：域冒烟生成器已合并，CI工件含domain-smoke-created.txt

- v1.2：域权重+权重优先冒烟+真实断言 已提交

- v1.3：仪表板按域权重展示冒烟优先级

- v1.5：域冒烟模板与Top失败分析已合并

- v1.6：加权冒烟门禁与Top失败域记录已合并（见 reports/smoke-gate.txt）

- v1.7：Cursor设置增强与MCP启停脚本已合并（enable_mcp/disable_mcp）

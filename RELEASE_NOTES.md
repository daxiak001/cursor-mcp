# Release v0.1.0

- S1: MCP工具与脚本闭环（预检/质量/覆盖率/打包），本地Git与PR模板
- S2: 政策改表即用（routing阈值演示），CI集成
- S3: VDCP最小AST补丁工具（demo+test），CI验证
 - 安全门禁：Semgrep+Gitleaks；质量门禁：覆盖率阈值；规则：禁硬编码

---

# Release v0.2.0

- 差异选测：基于 Git 变更选择性运行测试（scripts/diff_test.cjs）
- 安全工作流：.github/workflows/security.yml（Semgrep/Gitleaks）
- PR模板：.github/PULL_REQUEST_TEMPLATE.md 自检清单
- VDCP增强：AST补丁新增 add_function / update_call_argument（含测试）
- 文档更新：索引、CI指南、交付摘要同步

---

# Release v0.4.0

- VDCP：新增 AST 操作 insert_param / add_guard_clause（含演示补丁与单测）
- 文档：更新 apply_ast_patch 规范与索引条目

---

# Release v1.0.0

# Release v1.2.0

- Domains 权重：policy/domains.json 增加 weight 字段
- 域冒烟最小真实断言：校验域目录存在
- 增强选测排序：按域权重优先加入 smoke 用例

- MCP→ZPCP→VDCP 三阶段骨架与闭环示范完成
- 受影响域与域阈值：reports/affected-domains.{txt,json} + policy/domain-thresholds.json
- 增强选测：reports/tests-to-run-augmented.txt（按域补充smoke模式）
- 自动确认模式：enable/disable 脚本与 settings 接入（XIAOLIU_AUTO_CONFIRM）
- 协作增强：PR/Issue 模板与 PR 草稿脚本（scripts/create_pr_draft.ps1）
- 交付与仪表板：Delivery Summary、Completion Checklist、reports/ci-dashboard.md

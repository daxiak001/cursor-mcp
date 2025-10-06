# CI 与 Hooks 使用指南（S2）

目的：把规则落实在提交与合并链路，避免“开发后期才发现问题”。

## 本地 Hooks（建议 .husky/ 或 .git/hooks/）
- pre-commit：
  - 运行：lint/format（ESLint/Prettier 或 Ruff/Black）
  - 运行：semgrep（SAST）
  - 运行：gitleaks（Secrets）
  - 失败即阻断提交
- pre-push：
  - 运行：单元测试（阈值可设）
  - 运行：契约校验（OpenAPI/Schema 对齐检查，占位）

## CI（ci/pipeline.yml 示例职责）
- 触发：PR 打开/更新
- 步骤：
  1) 安装依赖（Node/Python）
  2) Lint + 格式化检查（只报问题，不强制修复）
  3) 单测 + 覆盖率阈值（核心域≥80%，一般域≥60%）
  4) 合规扫描：semgrep/gitleaks/npm audit/pip-audit/license-checker
  5) 契约校验：OpenAPI/Schema 与代码一致性
- 通过标准：以上步骤均通过才允许合并

## 例外与灰度
- exceptions.json：记录临时豁免（带到期时间），避免永久豁免
- 新规则灰度：先仅CI告警，不阻断；稳定后再启用阻断

## 与文档联动
- 所有CI/Hooks结果路径需在“开发跟进记录.md”登记为[#TEST]证据
- 阶段完成在“阶段登记表.md”记录[#STAGE]并附CI通过链接

## 安全工作流（security.yml）
- 触发：pull_request、push(main)
- 步骤：Semgrep（SAST）+ Gitleaks（Secrets）
- 策略：发现高危则阻断；可通过 exceptions.json 临时豁免（需到期）
- 位置：.github/workflows/security.yml

## PR模板
- 位置：.github/PULL_REQUEST_TEMPLATE.md
- 清单：单测/覆盖率/semgrep/gitleaks/契约/文档更新 均需勾选
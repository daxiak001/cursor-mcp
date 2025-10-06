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

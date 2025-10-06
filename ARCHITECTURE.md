# ARCHITECTURE

层次：
- S1（MCP）：mcp/tools + 接口/工具契约 + 测试清单
- S2（ZPCP）：policy + hooks + ci + 质量阈值
- S3（VDCP）：vdcp（AST/Schema/选测/核心域）

执行流（单窗口）：
快速索引 → 执行卡 → mcp工具检查 → 测试 → 登记（跟进/阶段） → 如有策略改动则改表即用 → 如属核心域则走AST补丁与选测

目录映射：
- mcp/ （S1工具与规范）
- policy/、hooks/、ci/（S2策略与门禁）
- vdcp/（S3核心域能力）
- 接口/（工具契约、模块接口清单）
- 测试/、reports/（测试与报告）
- scripts/（初始化/登记/归档/覆盖率导出）
- 运行指南/三阶段计划/交付摘要/PR检查清单/质量阈值

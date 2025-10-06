# apply_ast_patch（规范）

目的：AI不直接写自由文本代码，而是提交AST Patch JSON；由工具生成代码并通过策略/测试。

输入（ast_patch.schema.json）：
- file_path: string
- operations: [ { op: add|remove|replace, selector: AST选择器, value?: 代码片段 } ]

流程：
1) 读取AST并定位selector
2) 应用op
3) 生成代码并运行policy/hooks/ci必要子集
4) 通过后写入与登记

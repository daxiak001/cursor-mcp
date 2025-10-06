# apply_ast_patch（规范）

目的：AI不直接写自由文本代码，而是提交 AST Patch JSON；由工具生成代码并通过策略/测试。

入口脚本：`scripts/apply_ast_patch.cjs`

输入格式（简化）：参考 `vdcp/ast_ops.schema.json`
- operations: Operation[]，按文件自动分组与顺序执行

支持的 Operation.type：
- insert_import: 向文件插入/合并命名导入
- add_function: 在顶层新增导出函数（若不存在）
- update_call_argument: 更新指定调用的某个参数
- insert_param: 向指定函数插入参数（可设默认值与插入位置）
- add_guard_clause: 为指定函数添加前置守卫返回

示例：
```json
{
  "operations": [
    { "type": "insert_import", "file": "tests/fixtures/tmp.ts", "module": "vitest", "named": ["describe"] },
    { "type": "add_function", "file": "src/x.ts", "name": "hello", "params": ["name"], "returnLiteral": "world" },
    { "type": "update_call_argument", "file": "src/y.ts", "callee": "printf", "argIndex": 0, "newArg": "'ok'" },
    { "type": "insert_param", "file": "src/z.ts", "functionName": "sum", "param": "b", "default": "1", "index": 1 },
    { "type": "add_guard_clause", "file": "src/u.ts", "functionName": "greet", "param": "name", "kind": "falsy", "returnLiteral": "'bad'" }
  ]
}
```

流程：
1) 读取 JSON 并按 `operation.file` 分组
2) 对每个文件构建 TS AST 并按序执行 Operation
3) 打印更新并写回源码；CI 将执行选测/门禁
4) 通过后在“开发跟进记录.md”与“阶段登记表.md”登记

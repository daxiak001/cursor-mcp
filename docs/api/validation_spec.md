### 验收清单
- [ ] 校验步骤（语义/结构/静态/AST）
- [ ] 返回格式与错误码
- [ ] 不可跳过的门禁项

### 目的
统一 `validate_output` 的校验流程与响应结构，确保可机审与可回溯。

### 校验步骤
1. 结构校验：文件存在、路径/命名、基本 schema 通过。
2. 静态分析：ESLint/Flake/类型检查（如适用）。
3. 语义规则：规则系统匹配（禁止/必需项）。
4. AST 校验：语言级禁用模式/注释/安全项。

### 响应格式
```
{
  "ok": true | false,
  "issues": [
    { "id": "VAL-001", "level": "error|warn", "message": "...", "path": "...", "suggest": "...", "astPatch": { /* optional */ } }
  ],
  "metrics": { "files": 10, "errors": 0, "warnings": 2 }
}
```

### 错误码建议
- VAL-001 结构缺失
- VAL-101 静态分析错误
- VAL-201 规则违反
- VAL-301 AST 违规

### 门禁
- 任何 `level=error` 不可进入 in_test/validated。

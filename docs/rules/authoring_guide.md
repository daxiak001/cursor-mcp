### 验收清单
- [ ] 规则书写模板（MUST/SHOULD/MAY，无二义性）
- [ ] 好/坏示例
- [ ] 可执行性与校验兼容性要求

### 目的
指导撰写“可执行、可校验、可合并”的规则文本。

### 写作原则
- 使用明确动词：MUST/SHOULD/MAY/MUST NOT。
- 指向具体对象：文件/函数/PR/接口名，避免模糊。
- 可被机器识别：提供路径/语言/标签/正则或 AST 线索。

### 规则模板
```
ID: RL-<唯一ID>
Title: <一句话规则名>
Scope: [developer|product_manager|...]
Level: core|high|medium|low
Priority: 1..5
Text:
  MUST 在 <路径/模块> 中 <动作>。
  MUST NOT 使用 <禁用API/模式>。
Examples:
  Good: <示例>
  Bad: <示例>
```

### 示例
- Good: "MUST 在 `api/` 目录下为每个 endpoint 提供 OpenAPI 描述"
- Bad:  "尽量写好 API 文档"

### 校验兼容性
- 为规则提供检索线索（文件路径、语言、标记）。
- 为禁止项提供正则/AST 提示，便于静态分析集成。

### 合并与冲突
- 同一 Scope 冲突时，遵循 `merge_strategy`（见 merge_and_conflict.md）。

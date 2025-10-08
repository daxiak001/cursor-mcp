### 验收清单
- [ ] ESLint/Flake 配置示例
- [ ] CI 集成与自动修复策略

### 策略
- 本地与 CI 使用同一规则集。
- 对 `warn` 级别尝试自动修复；`error` 阻断流程。

### 示例
- JS/TS: ESLint + Prettier。
- Python: flake8/ruff + black。

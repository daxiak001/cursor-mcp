### 验收清单
- [ ] 定义通信方式（REST/WebSocket）与端点
- [ ] 缓存与失效策略（TTL/版本）
- [ ] 重试/超时/幂等与错误处理
- [ ] 安全（API Token/RBAC）

### 目的
规范 Cursor 插件与后端服务的交互、缓存、安全与可靠性策略。

### 通信
- REST: 主要接口（见 `api/openapi.yml`）。
- 可选 WebSocket: 订阅长任务状态更新（UI测试/会议）。

### 缓存
- 规则缓存：短期缓存 ruleset（含 `version` 与 `expiresAt`）。
- 失效：任务上下文变化、明确失效指令、版本不匹配。

### 重试与超时
- 统一超时：15s（可配置）。
- 重试：指数退避，最多 3 次；幂等端点需包含 `requestId`。

### 错误处理
- 统一错误格式：`{ code, message, details }`。
- 分类：4xx（参数/鉴权/状态）、5xx（服务/依赖）。

### 安全
- API Token 通过 `Authorization: Bearer <token>`。
- RBAC：按角色限制敏感操作（如强制注入、规则修改）。

### 遥测与日志
- 每次调用记录 latency、status、payload 大小（不含敏感内容）。

### 验收清单
- [ ] 包含系统高级组件说明与边界
- [ ] 给出端到端数据流（生成→校验→UI测试→会议）的步骤
- [ ] 标注关键 API、缓存/重试与同步点
- [ ] 提供 SVG 架构图占位与导出说明

### 目的
一页看清 Cursor 插件、Flask 服务、Worker/Job 队列、SQLite、UI 测试与会议引擎的关系与调用流。

### 组件与职责
- Cursor 插件: 注入规则、发起生成、展示校验/测试结果、缓存短期规则包。
- Flask API 服务: 统一入口，规则查询、生成上报、校验、启动长任务（UI 测试/会议）。
- Worker/Job 队列: 处理长任务（UI 测试、视觉比对、会议整理等），提供 job_id 与状态查询。
- SQLite: 存储规则、任务、审计日志、lessons 与升级候选。
- UI 测试 Worker: 执行 Playwright 脚本、上传截图与比对结果。
- 会议引擎: 多轮会议状态机、记录与自动提取 upgrade_candidates。

### 数据流概览
1) 规则注入: 插件→Flask `/get_rules_for_task` → 规则集合（按 ruleset/selector）
2) 生成上报: 插件→Flask `/submit_generation` → 写入审计与待校验队列
3) 输出校验: 插件/服务→`/validate_output` → 返回错误/建议/AST Patch（可选）
4) UI 测试: 插件→`/start_ui_test` → Job 队列 → 截图/比对 → 回写结果
5) 会议引擎: 插件/服务→`/start_meeting` → 多轮记录 → 输出 lessons/upgrade_candidates

同步点与缓存
- 规则缓存: 插件端短期缓存 ruleset（带版本与失效策略）
- 校验阻断: validate 未通过时，不进入“交付完成”态
- UI 测试门禁: 视觉差异阈值通过才可进入“validated”

### 关键 API（详见 `api/openapi.yml`）
- POST `/get_rules_for_task`
- POST `/submit_generation`
- POST `/validate_output`
- POST `/start_ui_test`
- GET  `/job_status/{jobId}`
- POST `/start_meeting`

### 典型工作流（简版）
1. 插件请求规则 → 生成实现 → 上报产物
2. 服务触发校验（语义/AST/静态分析）→ 返回问题与修复建议
3. 触发 UI 测试 → 截图/比对 → 通过则标记 validated
4. 召开会议（必要时）→ 记录 lessons → 生成 upgrade candidates

### 架构图
建议将矢量图保存为 `docs/overview/architecture.svg` 并在此引用：

![Architecture](./architecture.svg)

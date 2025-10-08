### 验收清单
- [ ] job 生命周期与状态机
- [ ] 并发/重试/超时策略
- [ ] 回调/轮询接口

### 生命周期
- created → queued → running → succeeded|failed|timeout|canceled

### 策略
- 并发限制：按队列类型配置（UI测试较低）。
- 重试：指数退避，最多 3 次；幂等由 `jobId` 保证。
- 超时：默认 10 分钟，可按任务类型调整。

### 查询
- 轮询：GET `/job_status/{jobId}`。
- 回调：注册 webhook（可选）。

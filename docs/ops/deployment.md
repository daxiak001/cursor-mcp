### 验收清单
- [ ] 部署拓扑（单机→集群）
- [ ] Docker Compose/k8s 模板提示
- [ ] CI/CD 管线要点

### 部署
- 单机：Flask + Worker + SQLite。
- 集群：服务横向扩展，Worker 池与队列服务（如 Redis/RabbitMQ）。

### 模板
- Compose：定义服务、网络、卷；健康检查。
- k8s：Deployment、Service、ConfigMap、Secret、HPA。

### CI/CD
- 构建镜像、运行测试、更新部署与回滚策略。

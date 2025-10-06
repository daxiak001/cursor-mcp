# 分支与PR指南

分支命名：
- feature/export-module
- fix/rules-hardcode-check
- chore/docs-architecture

提交信息规范（建议使用）：
- feat: 新增导出模块接口，反硬编码配置
- fix: 修复CSV转义换行问题
- docs: 更新三阶段计划与索引
- chore: 脚本与CI配置更新

PR说明模板：
- 做了什么：
- 为什么这么做：
- 影响范围：
- 回滚策略：
- 关联文档与证据：链接到 测试报告/登记/索引/变更日志

流程：
1) 从main切出分支
2) 本地通过 hooks（pre-commit/pre-push）
3) 提交PR，CI通过后再评审合并
4) 合并后在 CHANGELOG.md 增加条目

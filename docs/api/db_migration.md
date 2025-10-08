### 验收清单
- [ ] 迁移脚本与备份策略
- [ ] VACUUM/索引维护

### 迁移
- 使用版本化脚本（时间戳命名）。
- 先备份 `.db` 文件，完成后执行 VACUUM。

### 维护
- 定期 VACUUM 与 ANALYZE。
- 针对高频查询添加索引（见 `rules/sqlite_schema.sql`）。

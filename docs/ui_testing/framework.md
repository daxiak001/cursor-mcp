### 验收清单
- [ ] 工具选型与理由（Playwright）
- [ ] 执行环境/账号/数据重置策略
- [ ] 结果上传与视觉比对接口

### 工具选型
- Playwright（Chromium/Firefox/WebKit）、CI 可并行。

### 执行环境
- 推荐容器镜像，内置浏览器依赖。
- 账号管理：测试账号池与重置脚本。
- 数据准备：测试前清理、快照恢复或种子数据。

### 结果
- 截图：关键步骤截图与保存路径规范。
- 上传：POST `/ui_test_artifacts`（由后端实现，或复用 `/start_ui_test` 回写）。
- 视觉比对：参见 `ui_testing/visual_diff.md`，产出 `ssim` 与阈值决策。

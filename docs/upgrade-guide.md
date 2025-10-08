# 系统升级指南

**版本：** 1.0  
**最后更新：** 2025-10-08  
**适用范围：** 所有系统升级  

---

## 📋 目录

1. [升级前准备](#升级前准备)
2. [升级方式选择](#升级方式选择)
3. [升级步骤](#升级步骤)
4. [升级后验证](#升级后验证)
5. [回滚指南](#回滚指南)
6. [常见问题](#常见问题)
7. [最佳实践](#最佳实践)

---

## 升级前准备

### 1. 运行升级前检查清单

```bash
# 交互式检查（推荐）
node scripts/tools/upgrade-checklist.cjs run

# 自动检查
node scripts/tools/upgrade-checklist.cjs auto
```

**检查项包括：**
- ✅ 完整备份当前系统
- ✅ 记录文件清单
- ✅ 记录依赖版本
- ✅ 验证系统健康状态
- ✅ 准备回滚方案

### 2. 创建备份

```bash
# 手动备份（推荐）
git stash
git branch backup-$(date +%Y%m%d_%H%M%S)

# 查看备份分支
git branch --list backup-*
```

### 3. 通知团队

- 📢 通知团队成员即将升级
- 📅 确定升级时间窗口
- 👥 分配验证责任人

---

## 升级方式选择

### ✅ 推荐方式：增量修改

**适用场景：**
- 在现有文件中添加新功能
- 修改现有配置
- 扩展API端点

**工具：** `search_replace`

**示例：**

```javascript
// 在现有函数后添加新函数
search_replace(
  file_path: "scripts/core/rule-engine-server.cjs",
  old_string: "// 最后一个API端点\napp.listen(...)",
  new_string: "// 新增API端点\napp.post('/api/new', ...)\n\n// 最后一个API端点\napp.listen(...)"
)
```

**优点：**
- ✅ 保留所有原有功能
- ✅ 最小化破坏性
- ✅ 易于回滚
- ✅ 清晰的变更历史

### ✅ 允许方式：创建新文件

**适用场景：**
- 全新功能模块
- 独立工具脚本
- 新规则定义

**示例：**

```bash
# 创建新的工具脚本
scripts/tools/new-feature.cjs

# 创建新的规则文件
policy/new-rules-l3.yaml
```

**要求：**
- 使用清晰的文件名
- 添加完整的注释
- 更新相关文档

### ❌ 禁止方式：整体替换文件

**禁止原因：**
- ❌ 可能丢失重要功能
- ❌ 难以追溯变更
- ❌ 回滚困难

**例外情况：**
仅在以下情况允许：
1. 已完整备份并验证
2. 文件是全新创建的配置文件
3. 经过团队评审确认

---

## 升级步骤

### Step 1: 升级前检查

```bash
# 1. 运行检查清单
node scripts/tools/upgrade-checklist.cjs run

# 2. 确认系统健康
npm run rule-engine:test

# 3. 检查Git状态
git status
```

### Step 2: 执行升级

根据升级内容选择方式：

#### 方式A：增量修改现有文件

```bash
# 1. 确认要修改的文件
# 2. 使用search_replace精准定位
# 3. 在特定位置插入代码
# 4. 验证修改正确
```

#### 方式B：创建新文件

```bash
# 1. 确定文件位置和命名
# 2. 编写完整代码
# 3. 添加必要的注释和文档
# 4. 更新导入引用
```

#### 方式C：调整目录结构

```bash
# 1. 规划新的目录结构
# 2. 移动文件
# 3. 更新所有引用路径
# 4. 验证导入正常
```

### Step 3: 实时验证

```bash
# 每完成一个模块立即验证
npm run rule-engine:test

# 检查文件完整性
node scripts/tools/file-integrity-check.cjs check
```

### Step 4: 升级后完整验证

```bash
# 1. 文件完整性检查
node scripts/tools/file-integrity-check.cjs check

# 2. 依赖完整性
npm list --depth=0

# 3. 核心功能验证
npm run rule-engine:test

# 4. 集成测试
npm run test

# 5. 生成升级报告
node scripts/tools/generate-upgrade-report.cjs
```

---

## 升级后验证

### 验证清单

| 序号 | 验证项 | 命令 | 是否关键 |
|------|--------|------|----------|
| 1 | 文件完整性 | `node scripts/tools/file-integrity-check.cjs check` | ✅ 是 |
| 2 | 依赖完整性 | `npm list --depth=0` | ✅ 是 |
| 3 | 规则引擎 | `npm run rule-engine:test` | ✅ 是 |
| 4 | 集成测试 | `npm run test` | 否 |
| 5 | Git Hook | 提交测试文件 | 否 |
| 6 | 监控系统 | `npm run monitor:report` | 否 |

### 验证脚本

```bash
#!/bin/bash
# 完整验证脚本

echo "🔍 开始升级后验证..."

# 1. 文件完整性
echo "\n1. 检查文件完整性..."
node scripts/tools/file-integrity-check.cjs check || exit 1

# 2. 依赖完整性
echo "\n2. 检查依赖..."
npm list --depth=0 || echo "⚠️  存在依赖问题"

# 3. 规则引擎测试
echo "\n3. 测试规则引擎..."
npm run rule-engine:test || exit 1

# 4. 集成测试
echo "\n4. 运行集成测试..."
npm run test || echo "⚠️  部分测试失败"

echo "\n✅ 验证完成！"
```

---

## 回滚指南

### 何时需要回滚

**立即回滚的情况：**
- ❌ 文件完整性检查失败（发现文件丢失）
- ❌ 规则引擎无法启动
- ❌ 核心功能验证失败
- ❌ 生产环境故障

**考虑回滚的情况：**
- ⚠️ 依赖冲突无法快速解决
- ⚠️ 测试失败率>30%
- ⚠️ 性能严重下降

### 回滚步骤

```bash
# 1. 停止所有服务
pm2 stop all

# 2. 恢复到备份分支
git reset --hard backup-YYYYMMDD_HHMMSS

# 3. 恢复依赖
npm install

# 4. 清理升级痕迹
rm -rf .upgrade/

# 5. 重启服务
pm2 restart all

# 6. 验证回滚成功
npm run rule-engine:test

# 7. 记录回滚原因
echo "回滚原因: ..." >> .upgrade/rollback-log.txt
```

### 回滚后分析

1. 📝 记录失败原因
2. 🔍 分析根本问题
3. 💡 设计改进方案
4. 🧪 在测试环境验证
5. 🔄 重新规划升级

---

## 常见问题

### Q1: 升级后文件丢失怎么办？

**A:** 立即执行以下步骤：

```bash
# 1. 停止升级
# 2. 检查哪些文件丢失
node scripts/tools/file-integrity-check.cjs diff

# 3. 从备份恢复
git checkout backup-branch -- <丢失的文件>

# 4. 分析原因（检查是否误删或路径错误）
```

### Q2: 依赖冲突如何解决？

**A:** 按以下顺序尝试：

```bash
# 1. 删除node_modules和package-lock.json
rm -rf node_modules package-lock.json

# 2. 清理npm缓存
npm cache clean --force

# 3. 重新安装
npm install

# 4. 如果仍有问题，检查package.json中的版本约束
```

### Q3: 规则引擎无法启动？

**A:** 检查以下几点：

```bash
# 1. 检查日志
pm2 logs xiaoliu-rule-engine --lines 50

# 2. 检查端口占用
netstat -ano | findstr :3000

# 3. 检查规则文件语法
# 查看是否有YAML语法错误

# 4. 尝试直接运行
node scripts/core/rule-engine-server.cjs
```

### Q4: 如何验证增量修改是否正确？

**A:** 使用以下方法：

```bash
# 1. 查看具体变更
git diff

# 2. 对比升级前后
git diff backup-branch

# 3. 检查特定文件
git diff backup-branch -- scripts/core/rule-engine-server.cjs
```

---

## 最佳实践

### 1. 小步快跑 🏃

- ✅ 每次只升级一个功能模块
- ✅ 每个模块升级后立即验证
- ✅ 降低单次升级风险

### 2. 增量为主 📈

- ✅ 优先使用增量修改
- ✅ 避免整体替换文件
- ✅ 保留所有原有功能

### 3. 详细记录 📝

- ✅ 记录每步操作
- ✅ 记录决策原因
- ✅ 记录遇到的问题和解决方案

### 4. 充分验证 🧪

- ✅ 升级前验证系统健康
- ✅ 升级中实时验证
- ✅ 升级后完整验证

### 5. 准备回滚 🔄

- ✅ 始终保持备份
- ✅ 熟悉回滚步骤
- ✅ 设定回滚触发条件

### 6. 团队协作 👥

- ✅ 升级前通知团队
- ✅ 分配验证责任
- ✅ 集体评审变更

---

## 升级模板

### 升级前沟通模板

```
主题：系统升级通知

升级时间：YYYY-MM-DD HH:MM
升级内容：[简要描述]
影响范围：[哪些功能]
预计时长：[X小时]
验证责任人：[@某人]

升级步骤：
1. ...
2. ...

回滚方案：
1. ...
2. ...
```

### 升级报告模板

```markdown
# 系统升级报告

**升级时间：** YYYY-MM-DD HH:MM  
**升级人员：** [姓名]  
**升级版本：** vX.X.X → vY.Y.Y  

## 升级内容
- [ ] 功能1
- [ ] 功能2

## 验证结果
- [x] 文件完整性：通过
- [x] 规则引擎：通过
- [ ] 集成测试：部分失败

## 遇到的问题
1. 问题描述
   - 解决方案

## 下一步行动
1. ...
```

---

## 参考资料

- 📖 [SYS-011 系统升级安全规范](../policy/sys-upgrade-l3.yaml)
- 📖 [文件完整性检查工具](../scripts/tools/file-integrity-check.cjs)
- 📖 [升级前检查清单](../scripts/tools/upgrade-checklist.cjs)
- 📖 [三阶段升级总计划](../三阶段升级总计划.md)

---

**记住：安全升级的核心是备份、验证、记录！** 🎯


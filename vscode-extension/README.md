# 小柳质量守卫 - VSCode插件

## 📋 插件简介

小柳质量守卫VSCode插件是三层防护体系的第一层，提供**实时代码质量检查和保存拦截功能**。

### 核心功能
- ✅ 保存前自动检查代码质量
- ✅ 发现违规立即阻止保存
- ✅ 30秒自动健康检查
- ✅ 错误处理和自动重试
- ✅ 优雅降级机制

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd vscode-extension
npm install
```

### 2. 编译插件

```bash
npm run compile
```

### 3. 启动调试

```
1. 在VSCode中打开 vscode-extension 文件夹
2. 按 F5 启动调试
3. 在新打开的窗口中使用插件
```

### 4. 验证功能

```javascript
// 创建测试文件 test.js
const password = 'hardcoded123';  // 应该被阻止

// 保存文件（Ctrl+S）
// 预期：弹出错误提示，阻止保存
```

---

## 🎯 使用指南

### 状态栏图标

| 图标 | 说明 |
|------|------|
| `$(shield) 守卫(17规则)` | 规则引擎运行正常 |
| `$(shield) $(warning) 离线` | 规则引擎未连接 |
| `$(shield) $(check) 已保存` | 文件保存成功 |

### 命令列表

打开命令面板（`Ctrl+Shift+P`）：

| 命令 | 说明 |
|------|------|
| `小柳: 检查代码质量` | 手动检查当前文件 |
| `小柳: 检查对话行为` | 手动检查对话内容 |
| `小柳: 重新加载规则` | 重新加载规则引擎规则 |

---

## ⚙️ 配置选项

### settings.json配置

```json
{
  // 规则引擎URL
  "xiaoliu.ruleEngineUrl": "http://localhost:3000",
  
  // 启用代码检查
  "xiaoliu.enableCodeCheck": true,
  
  // 发现错误时阻止保存
  "xiaoliu.blockOnError": true
}
```

### 工作区配置

```json
// .vscode/settings.json
{
  "xiaoliu.enableCodeCheck": false  // 临时禁用检查
}
```

---

## 🔍 检查规则

### 代码质量规则

#### IR-003: 禁硬编码
```javascript
// ❌ 错误：硬编码
const password = 'test123';
const apiKey = "sk-xxxxx";

// ✅ 正确：使用环境变量
const password = process.env.DB_PASSWORD;
const apiKey = process.env.API_KEY;
```

#### IR-005: 函数长度限制
```javascript
// ❌ 警告：函数超过100行
function veryLongFunction() {
  // ... 超过100行代码
}

// ✅ 正确：拆分成多个函数
function step1() { /* ... */ }
function step2() { /* ... */ }
function mainFunction() {
  step1();
  step2();
}
```

#### IR-007: 禁调试代码
```javascript
// ❌ 错误：包含调试代码
console.log('debug info');
debugger;

// ✅ 正确：移除调试代码或使用日志库
logger.info('info');
```

### 对话行为规则

#### IR-031: 确认卡必需
```markdown
❌ 错误：缺少确认卡
直接执行任务...

✅ 正确：先输出确认卡
**理解：** 用户要求...
**方案：** 采用...方案
**风险：** 可能导致...
**确认点：** 1. xxx 2. yyy

理解无误后开始执行。
```

#### SIL-003: 禁询问用户
```markdown
❌ 错误：询问用户
是否需要继续？
你想怎么做？

✅ 正确：自主决策
根据需求分析，我将执行...
```

---

## 🛡️ 保存拦截流程

### 正常流程

```
用户保存文件（Ctrl+S）
  ↓
触发 onWillSaveTextDocument
  ↓
调用规则引擎检查代码
  ↓
检查通过 → 允许保存 → 显示"$(check) 已保存"
```

### 违规流程

```
用户保存文件（Ctrl+S）
  ↓
触发 onWillSaveTextDocument
  ↓
调用规则引擎检查代码
  ↓
发现违规 → 弹出提示框
  ↓
用户选择：
  - "取消" → 阻止保存
  - "查看详情" → 显示违规详情 → 阻止保存
  - "强制保存" → 允许保存（记录日志）
```

---

## 🔧 错误处理

### 自动重试机制

```typescript
// 带重试的API调用
fetchWithRetry(url, options, retries = 3)
  - 第1次失败：等待100ms后重试
  - 第2次失败：等待200ms后重试
  - 第3次失败：抛出错误
```

### 优雅降级

```
规则引擎不可用
  ↓
显示警告："代码检查失败，优雅降级（允许保存）"
  ↓
返回 { pass: true, violations: [] }
  ↓
允许保存（不阻止开发）
```

### 健康检查

```
插件启动
  ↓
立即检查规则引擎健康
  ↓
每30秒自动检查
  ↓
状态栏图标实时更新：
  - 在线：$(shield) 守卫(17规则)
  - 离线：$(shield) $(warning) 离线
```

---

## 📊 工作原理

### 架构图

```
VSCode Extension
  ├─ Extension Host（插件主进程）
  │   ├─ activate() - 插件激活
  │   ├─ statusBarItem - 状态栏
  │   ├─ healthCheckInterval - 健康检查定时器
  │   └─ commands - 命令注册
  │
  ├─ Event Handlers（事件处理）
  │   ├─ onWillSaveTextDocument - 保存前拦截
  │   ├─ onDidSaveTextDocument - 保存后提示
  │   └─ onWillSendMessage - AI消息拦截（未实现）
  │
  └─ API Client（API客户端）
      ├─ fetchWithRetry() - 带重试的请求
      ├─ checkRuleEngineHealth() - 健康检查
      ├─ checkCodeQuality() - 代码检查
      └─ checkDialogueBehavior() - 对话检查
```

### 技术栈

- **语言**：TypeScript
- **框架**：VSCode Extension API
- **HTTP客户端**：node-fetch
- **构建工具**：tsc（TypeScript编译器）

---

## 🐛 故障排查

### 问题1：插件无法加载

**症状**：状态栏没有"小柳守卫"

**解决**：
```bash
# 1. 检查编译
npm run compile

# 2. 查看编译输出
ls out/extension.js

# 3. 查看VSCode开发者工具
# Help → Toggle Developer Tools → Console
```

### 问题2：规则引擎离线

**症状**：状态栏显示"$(shield) $(warning) 离线"

**解决**：
```bash
# 1. 检查规则引擎
curl http://localhost:3000/api/health

# 2. 启动规则引擎
pm2 start scripts/rule-engine-server.cjs --name xiaoliu-rule-engine

# 3. 查看日志
pm2 logs xiaoliu-rule-engine
```

### 问题3：保存时没有检查

**症状**：违规代码可以保存

**解决**：
```json
// 检查配置
{
  "xiaoliu.enableCodeCheck": true,  // 确保为true
  "xiaoliu.blockOnError": true      // 确保为true
}
```

---

## 📝 开发指南

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 开发模式（自动编译）
npm run watch

# 3. 按F5启动调试
# 修改代码后，重新加载窗口（Ctrl+R）
```

### 添加新规则

```typescript
// src/extension.ts

// 1. 在checkCodeQuality中添加检查逻辑
async function checkCodeQuality(document: vscode.TextDocument) {
  // ... 调用规则引擎API
}

// 2. 或在规则引擎中添加规则
// policy/core-l1.yaml
```

### 打包发布

```bash
# 安装vsce
npm install -g @vscode/vsce

# 打包成.vsix
vsce package

# 生成 xiaoliu-quality-guard-1.0.0.vsix

# 安装到VSCode
# Extensions → ... → Install from VSIX
```

---

## 📈 性能优化

### 1. 防抖优化

```typescript
// 避免频繁API调用
let checkTimeout: NodeJS.Timeout;
event.waitUntil(
  new Promise((resolve) => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(async () => {
      // 执行检查
    }, 300);  // 300ms防抖
  })
);
```

### 2. 缓存策略

```typescript
// 缓存检查结果
const cacheKey = `${document.fileName}:${document.version}`;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

### 3. 异步优化

```typescript
// 非阻塞检查
event.waitUntil(
  checkCodeQuality(document).catch(() => {
    // 错误不阻塞保存
    return { pass: true, violations: [] };
  })
);
```

---

## 🎯 未来计划

- [ ] AI消息拦截（onWillSendMessage）
- [ ] 检查结果缓存
- [ ] 离线规则包
- [ ] 自定义规则配置
- [ ] 性能监控

---

## 📚 相关文档

- [主文档](../README.md)
- [故障排查](../docs/troubleshooting.md)
- [架构文档](../ARCHITECTURE.md)
- [VSCode Extension API](https://code.visualstudio.com/api)

---

**版本：** 1.0.0  
**作者：** 小柳团队  
**许可：** MIT  
**最后更新：** 2025-10-07


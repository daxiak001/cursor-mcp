# 故障排查指南

## 🔍 常见问题解决方案

---

## 问题1：规则引擎未运行

### 症状
- VSCode状态栏显示 `$(shield) $(warning) 离线`
- Git Hook检查失败，提示"规则引擎未运行"
- API调用返回连接错误

### 诊断步骤

```bash
# 1. 检查PM2状态
pm2 status

# 2. 查看规则引擎日志
pm2 logs xiaoliu-rule-engine --lines 20

# 3. 测试健康检查API
curl http://localhost:3000/api/health
```

### 解决方案

#### 方案A：PM2进程不存在
```bash
# 启动规则引擎
npm run rule-engine:start

# 验证启动成功
pm2 status
```

#### 方案B：PM2进程异常退出
```bash
# 查看错误日志
pm2 logs xiaoliu-rule-engine --err

# 删除旧进程
pm2 delete xiaoliu-rule-engine

# 重新启动
npm run rule-engine:start
```

#### 方案C：端口被占用
```powershell
# 检查3000端口
netstat -ano | findstr :3000

# 如果被占用，杀死进程或修改配置
# 修改 scripts/rule-engine-server.cjs 中的端口
```

---

## 问题2：Git Hook不工作

### 症状
- `git commit` 没有触发质量检查
- 违规代码可以正常提交

### 诊断步骤

```powershell
# 1. 检查Hook文件是否存在
Test-Path .git\hooks\pre-commit

# 2. 手动运行Hook测试
pwsh hooks\pre-commit-enhanced.ps1

# 3. 检查Git配置
git config core.hooksPath
```

### 解决方案

#### 方案A：Hook文件不存在
```powershell
# 重新安装Hook
Copy-Item hooks\pre-commit-enhanced.ps1 .git\hooks\pre-commit -Force

# 验证文件存在
Get-Item .git\hooks\pre-commit
```

#### 方案B：Hook没有执行权限（Linux/Mac）
```bash
chmod +x .git/hooks/pre-commit
```

#### 方案C：Git hooksPath配置错误
```bash
# 重置hooksPath
git config --unset core.hooksPath

# 或设置为默认
git config core.hooksPath .git/hooks
```

---

## 问题3：VSCode插件无法加载

### 症状
- VSCode状态栏没有"小柳守卫"图标
- 保存文件时没有触发检查
- 插件命令不可用

### 诊断步骤

```bash
# 1. 检查编译输出
ls vscode-extension/out/extension.js

# 2. 检查编译错误
cd vscode-extension
npm run compile

# 3. 查看VSCode开发者工具
# 在VSCode中: Help → Toggle Developer Tools
```

### 解决方案

#### 方案A：插件未编译
```bash
cd vscode-extension
npm install
npm run compile
```

#### 方案B：编译错误
```bash
# 查看完整错误信息
npm run compile

# 安装缺失的类型定义
npm install --save-dev @types/node-fetch

# 重新编译
npm run compile
```

#### 方案C：插件未加载
```
1. 在VSCode中打开 vscode-extension 文件夹
2. 按 F5 启动调试
3. 在新打开的窗口中使用插件
```

---

## 问题4：代码检查失败（优雅降级）

### 症状
- 提示"代码检查失败，优雅降级（允许保存）"
- 文件可以保存，但没有执行检查

### 诊断步骤

```bash
# 1. 检查规则引擎
curl http://localhost:3000/api/health

# 2. 手动测试API
curl -X POST http://localhost:3000/api/check-code \
  -H "Content-Type: application/json" \
  -d '{"code":"test","filePath":"test.js"}'

# 3. 查看网络连接
# VSCode → Output → Xiaoliu Quality Guard
```

### 解决方案

#### 方案A：规则引擎未运行
参考"问题1：规则引擎未运行"

#### 方案B：网络超时
```javascript
// 增加超时时间（vscode-extension/src/extension.ts）
// 当前：timeout: 5000（5秒）
// 建议：timeout: 10000（10秒）
```

#### 方案C：API响应错误
```bash
# 查看规则引擎日志
pm2 logs xiaoliu-rule-engine

# 检查规则文件是否正确
cat policy/core-l1.yaml
cat policy/dialogue-l1.yaml
```

---

## 问题5：执行率验证失败

### 症状
- `npm run validate:execution-rate` 报错
- 显示执行率低于100%

### 诊断步骤

```bash
# 1. 运行验证测试
npm run validate:execution-rate

# 2. 查看详细输出
node scripts/validate-execution-rate.js

# 3. 检查规则引擎测试
npm run rule-engine:test
```

### 解决方案

#### 方案A：规则引擎测试失败
```bash
# 查看测试输出
npm run rule-engine:test

# 如果有失败，检查规则定义
# 修复后重新验证
npm run validate:execution-rate
```

#### 方案B：测试脚本错误
```bash
# 查看脚本是否存在
ls scripts/validate-execution-rate.js

# 检查Node.js版本
node --version  # 需要 >= 18
```

---

## 问题6：CI流程失败

### 症状
- GitHub Actions运行失败
- CI质量门禁报错

### 诊断步骤

```bash
# 1. 本地模拟CI
pwsh scripts/simulate-ci.ps1

# 2. 检查GitHub Actions日志
# 在GitHub仓库 → Actions → 查看运行日志

# 3. 验证CI配置
cat .github/workflows/quality-gate.yml
```

### 解决方案

#### 方案A：本地模拟通过，CI失败
```yaml
# 检查.github/workflows/quality-gate.yml中的命令
# 确保与本地一致

# 常见问题：
# 1. 路径问题（Linux vs Windows）
# 2. 环境变量未设置
# 3. 依赖版本不一致
```

#### 方案B：npm ci失败
```yaml
# 删除package-lock.json
rm package-lock.json

# 重新生成
npm install

# 提交更新后的lock文件
git add package-lock.json
git commit -m "fix: update package-lock"
```

---

## 问题7：PM2启动失败

### 症状
- `pm2 start` 命令报错
- 进程状态显示"errored"

### 诊断步骤

```bash
# 1. 查看错误日志
pm2 logs xiaoliu-rule-engine --err --lines 50

# 2. 手动运行脚本测试
node scripts/rule-engine-server.cjs

# 3. 检查PM2配置
pm2 list
```

### 解决方案

#### 方案A：脚本语法错误
```bash
# 查看完整错误信息
node scripts/rule-engine-server.cjs

# 修复错误后重新启动
pm2 restart xiaoliu-rule-engine
```

#### 方案B：依赖未安装
```bash
# 安装依赖
npm install

# 重新启动
pm2 restart xiaoliu-rule-engine
```

#### 方案C：端口冲突
```bash
# 修改端口
# 编辑 scripts/rule-engine-server.cjs
# const PORT = 3001;  // 改为其他端口

# 重启服务
pm2 restart xiaoliu-rule-engine
```

---

## 问题8：硬编码检测误报

### 症状
- 正常的字符串被识别为硬编码
- 环境变量使用仍被阻止

### 诊断步骤

```bash
# 1. 查看具体检测规则
grep -A 10 "IR-003" policy/core-l1.yaml

# 2. 测试具体代码
curl -X POST http://localhost:3000/api/check-code \
  -H "Content-Type: application/json" \
  -d '{"code":"你的代码","filePath":"test.js"}'
```

### 解决方案

#### 方案A：调整检测规则
```yaml
# 编辑 policy/core-l1.yaml
# 修改 IR-003 的 patterns

# 例如：排除某些关键词
patterns:
  - password\s*[:=]\s*["'](?!process\.env)
  - token\s*[:=]\s*["'](?!process\.env)
```

#### 方案B：添加例外
```javascript
// 在代码中添加注释标记
const config = "test"; // xiaoliu-ignore: IR-003
```

---

## 🛠️ 诊断工具

### 一键诊断脚本

```powershell
# 创建诊断脚本
@"
Write-Host "=== 小柳系统诊断 ===" -ForegroundColor Cyan

# 1. 检查PM2
Write-Host "`n1. PM2状态:" -ForegroundColor Yellow
pm2 status

# 2. 检查API
Write-Host "`n2. 规则引擎健康检查:" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/health"
} catch {
    Write-Host "API不可用: $_" -ForegroundColor Red
}

# 3. 检查Git Hook
Write-Host "`n3. Git Hook:" -ForegroundColor Yellow
if (Test-Path .git\hooks\pre-commit) {
    Write-Host "✓ 已安装" -ForegroundColor Green
} else {
    Write-Host "✗ 未安装" -ForegroundColor Red
}

# 4. 检查VSCode插件
Write-Host "`n4. VSCode插件:" -ForegroundColor Yellow
if (Test-Path vscode-extension\out\extension.js) {
    Write-Host "✓ 已编译" -ForegroundColor Green
} else {
    Write-Host "✗ 未编译" -ForegroundColor Red
}

Write-Host "`n=== 诊断完成 ===" -ForegroundColor Cyan
"@ | Out-File -FilePath diagnose.ps1 -Encoding UTF8

# 运行诊断
pwsh diagnose.ps1
```

---

## 📞 获取帮助

### 查看日志

```bash
# PM2日志
pm2 logs xiaoliu-rule-engine

# 系统日志
cat logs/rule-engine.log
cat logs/git-hook.log
```

### 重置系统

```bash
# 完全重置（谨慎使用）
pm2 delete xiaoliu-rule-engine
rm -rf logs/*
rm -rf vscode-extension/out
npm run rule-engine:start
cd vscode-extension && npm run compile
```

### 联系支持

- 查看文档：[README.md](../README.md)
- 查看架构：[ARCHITECTURE.md](../ARCHITECTURE.md)
- 查看修复计划：[遗留问题修复计划.md](../遗留问题修复计划.md)

---

**最后更新：** 2025-10-07


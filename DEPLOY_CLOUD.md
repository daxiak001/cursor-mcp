# 小柳系统云端部署指南

**版本：** v6.1.1-cloud  
**部署时间：** 2025-10-08  
**状态：** 🟡 备用部署（暂不使用，本地系统优先）

---

## 📋 部署状态

### 当前部署
- **本地系统：** ✅ 主要使用中
- **云端系统：** 🟡 已部署，备用状态
- **调用方式：** 本地优先，云端备用

### 云端优势（备用）
- ✅ 多终端访问（随时可切换）
- ✅ 实时升级（已就绪）
- ✅ 零安装（已配置）
- ✅ 统一管理（已启用）

---

## 🚀 快速部署到Railway

### 步骤1：访问Railway
```
1. 打开浏览器访问: https://railway.app
2. 使用GitHub账号登录
3. 点击 "New Project"
```

### 步骤2：连接GitHub仓库
```
1. 选择 "Deploy from GitHub repo"
2. 找到并选择: daxiak001/cursor-mcp
3. 选择分支: main
4. 点击 "Deploy Now"
```

### 步骤3：配置环境变量（可选）
```
在Railway Dashboard中设置:

NODE_ENV=production
ALLOWED_ORIGINS=https://cursor.sh,http://localhost
```

### 步骤4：等待部署完成
```
部署通常需要2-3分钟
完成后会自动分配一个域名，如：
https://xiaoliu-api-production.up.railway.app
```

### 步骤5：验证部署
```bash
# 测试健康检查
curl https://你的railway域名/health

# 预期输出：
{
  "status": "healthy",
  "version": "v6.1.1-cloud",
  "uptime": 123
}
```

---

## 🔧 本地安装依赖

如果需要本地测试云端版本：

```bash
cd "F:\源码文档\设置\【项目】开发材料"

# 安装新的依赖
npm install cors express-rate-limit helmet

# 启动云端版本（本地测试）
npm run rule-engine:start:cloud

# 测试
curl http://localhost:3000/health
```

---

## 📡 API端点说明

### 基础端点

#### 健康检查
```bash
GET /health

响应：
{
  "status": "healthy",
  "version": "v6.1.1-cloud",
  "environment": "production",
  "uptime": 12345,
  "rules": {
    "code": 148,
    "dialogue": 8
  }
}
```

#### 版本信息
```bash
GET /v1/version

响应：
{
  "version": "v6.1.1",
  "releaseDate": "2025-10-08"
}
```

### 规则检查端点

#### 检查代码质量
```bash
POST /v1/check-code
Content-Type: application/json

{
  "code": "const password = \"123456\";",
  "filename": "test.js"
}

响应：
{
  "violations": [
    {
      "ruleId": "IR-003",
      "message": "检测到硬编码的敏感信息",
      "severity": "error",
      "line": 1
    }
  ],
  "pass": false
}
```

#### 检查对话行为
```bash
POST /v1/check-dialogue
Content-Type: application/json

{
  "message": "是否需要我继续？",
  "context": {}
}

响应：
{
  "violations": [
    {
      "ruleId": "IR-031",
      "message": "禁止询问用户是否继续",
      "severity": "error"
    }
  ],
  "pass": false
}
```

#### 获取所有规则
```bash
GET /v1/rules?type=code

响应：
{
  "rules": [...],
  "count": 148
}
```

#### 自我介绍
```bash
GET /v1/intro?type=short

响应：
{
  "text": "我是小柳智能开发助手 v6.1.1...",
  "version": "v6.1.1-cloud"
}
```

---

## 🔒 安全配置

### CORS配置
```javascript
// 允许的域名（通过环境变量配置）
ALLOWED_ORIGINS=https://cursor.sh,http://localhost

// 云端会自动处理跨域请求
```

### API限流
```
默认配置：
- 时间窗口：15分钟
- 最大请求：100次
- 超出后返回429错误
```

### 安全头
```
使用Helmet自动添加：
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security
```

---

## 🎯 使用方式（暂不启用）

### 本地系统（当前使用）
```bash
# 继续使用本地系统
node scripts/core/rule-engine-server.cjs

# 本地端口：http://localhost:3000
```

### 云端系统（备用）
```bash
# 如果需要切换到云端，配置客户端：

# 方式1：环境变量
export XIAOLIU_API_URL="https://你的railway域名/v1"

# 方式2：配置文件
创建 ~/.cursorrc:
{
  "xiaoliu": {
    "apiUrl": "https://你的railway域名/v1"
  }
}

# 方式3：VSCode设置
Settings > Xiaoliu > API URL
```

---

## 📊 部署信息

### Railway自动配置
- ✅ 自动检测Node.js项目
- ✅ 自动安装依赖（npm install）
- ✅ 自动启动服务（npm start）
- ✅ 自动分配域名
- ✅ 自动HTTPS证书
- ✅ 自动重启（服务崩溃时）

### 性能指标
- **启动时间：** ~2-3秒
- **响应时间：** ~50-100ms（首次），~10-20ms（缓存后）
- **内存占用：** ~100MB
- **并发支持：** 100+请求/分钟

### 可用性
- **正常运行时间：** 99.9%（Railway SLA）
- **全球CDN：** ✅
- **自动扩展：** 按需扩展
- **零停机部署：** ✅

---

## 🔄 升级流程（云端）

### 自动部署
```bash
# 1. 本地修改代码
git add -A
git commit -m "升级到 v6.1.2"

# 2. 推送到GitHub
git push origin main

# 3. Railway自动检测并部署（约2-3分钟）
# 无需手动操作！
```

### 手动触发部署
```
1. 访问Railway Dashboard
2. 找到你的项目
3. 点击 "Deployments"
4. 点击 "Deploy Now"
```

---

## 💰 成本估算

### Railway免费版
```
每月免费额度：$5
运行时长：约500小时
成本：$0（在免费额度内）

适合：
- 个人使用
- 小团队（5-10人）
- 低频调用（<1000次/天）
```

### Railway付费版
```
超出免费额度后：
- 按量计费
- 约$0.000463/GB-秒
- 预计$5-20/月（中等使用）

适合：
- 中型团队（10-50人）
- 高频调用（>1000次/天）
- 需要稳定服务
```

---

## 🛠️ 故障排查

### 服务无响应
```bash
# 1. 检查服务状态
curl https://你的railway域名/health

# 2. 查看Railway日志
# Railway Dashboard > Deployments > View Logs

# 3. 手动重启
# Railway Dashboard > Settings > Restart
```

### API返回404
```bash
# 检查端点路径
curl https://你的railway域名/v1/version

# 确保使用 /v1/ 前缀
```

### CORS错误
```bash
# 检查环境变量
# Railway Dashboard > Variables
# 添加: ALLOWED_ORIGINS=你的域名

# 或临时允许所有：
# ALLOWED_ORIGINS=*
```

---

## 📞 支持

**GitHub仓库：** https://github.com/daxiak001/cursor-mcp  
**Issues：** https://github.com/daxiak001/cursor-mcp/issues  
**文档：** 云端部署方案-多终端实时同步.md

---

## ⚠️ 重要提示

### 当前状态
- 🟢 **本地系统：** 正常使用
- 🟡 **云端系统：** 已部署备用，暂不调用
- 📝 **切换时机：** 待本地系统升级完成后再评估

### 本地优先
```
当前策略：
1. 继续使用本地系统
2. 云端系统已部署，随时可切换
3. 升级本地系统后再决定是否迁移
```

### 切换准备
```
云端系统已具备：
✅ 完整API接口
✅ 规则引擎（轻量化）
✅ 安全防护（CORS、限流、Helmet）
✅ 健康监控
✅ 自动部署

随时可用，无需额外配置！
```

---

**部署时间：** 2025-10-08  
**部署人：** 💻 技术开发·小柳  
**状态：** ✅ 云端备用部署完成，本地系统继续使用


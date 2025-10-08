# API使用指南

## 📌 重要说明

系统API已分为两个独立服务：

- **端口3000**：规则引擎核心API（CLI可用）
- **端口3001**：自我介绍和团队配置API（PM2服务）

---

## 🚀 自我介绍API (端口3001)

### 服务状态
```bash
pm2 status api-intro
```

### API端点

#### 1. 简短介绍
```bash
curl http://localhost:3001/api/intro?type=short
```
响应示例：
```json
{
  "text": "我是小柳智能开发助手 v6.1.1（2025/10/8）"
}
```

#### 2. 完整介绍
```bash
curl http://localhost:3001/api/intro
```

#### 3. 团队介绍
```bash
curl http://localhost:3001/api/intro?type=team
```

#### 4. 版本信息
```bash
curl http://localhost:3001/api/intro?type=version
```

#### 5. 团队配置（JSON格式）
```bash
curl http://localhost:3001/api/team/config
```
响应示例：
```json
{
  "system_name": "小柳智能开发助手",
  "team": {
    "user_manager": {
      "name": "小户",
      "role": "用户经理"
    },
    "product_manager": {
      "name": "小品",
      "role": "产品经理"
    },
    "tech_developer": {
      "name": "小柳",
      "role": "技术开发"
    },
    "supervisor": {
      "name": "小观",
      "role": "监督管理"
    }
  }
}
```

#### 6. 角色信息
```bash
curl http://localhost:3001/api/team/role/user_manager
curl http://localhost:3001/api/team/role/product_manager
curl http://localhost:3001/api/team/role/tech_developer
curl http://localhost:3001/api/team/role/supervisor
```

---

## 🛠️ 规则引擎API (端口3000 - CLI模式)

### 为什么使用CLI？
由于PM2环境兼容性问题，规则引擎核心功能建议通过CLI访问。

### CLI工具

#### 1. 版本查询
```bash
cd "F:\源码文档\设置\【项目】开发材料"
node scripts/tools/version.cjs
```

#### 2. 自我介绍（CLI版本）
```bash
node scripts/tools/self-intro.cjs short    # 简短介绍
node scripts/tools/self-intro.cjs team     # 团队介绍
node scripts/tools/self-intro.cjs full     # 完整介绍
```

#### 3. 升级检查清单
```bash
node scripts/tools/upgrade-checklist.cjs run
```

#### 4. 文件完整性检查
```bash
node scripts/tools/file-integrity-check.cjs check
```

#### 5. MD转JSON
```bash
node scripts/tools/md-to-json-converter.cjs file input.md
node scripts/tools/md-to-json-converter.cjs dir ./ --recursive
```

#### 6. 版本递增
```bash
node scripts/tools/bump-version.cjs patch   # 0.0.1
node scripts/tools/bump-version.cjs minor   # 0.1.0
node scripts/tools/bump-version.cjs major   # 1.0.0
```

---

## 🔄 服务管理

### 启动服务
```bash
pm2 start scripts/core/api-intro-server.cjs --name api-intro
```

### 停止服务
```bash
pm2 stop api-intro
```

### 重启服务
```bash
pm2 restart api-intro
```

### 查看日志
```bash
pm2 logs api-intro
```

### 查看状态
```bash
pm2 status
```

---

## 📊 服务健康检查

### 检查API服务
```bash
curl http://localhost:3001/api/intro?type=short
```

### 检查CLI工具
```bash
node scripts/tools/version.cjs
```

---

## ⚠️ 故障排除

### API无响应
1. 检查服务状态：`pm2 status api-intro`
2. 查看错误日志：`pm2 logs api-intro --err`
3. 重启服务：`pm2 restart api-intro`

### API返回404
1. 确认使用正确端口（3001）
2. 确认服务在线：`pm2 status`
3. 使用CLI替代：`node scripts/tools/self-intro.cjs`

---

## 📝 示例脚本

### PowerShell示例
```powershell
# 获取系统版本
$version = curl -s "http://localhost:3001/api/intro?type=version"
Write-Host $version

# 获取团队配置
$team = curl -s "http://localhost:3001/api/team/config" | ConvertFrom-Json
Write-Host "系统名称: $($team.system_name)"
```

### Node.js示例
```javascript
const http = require('http');

// 获取简短介绍
http.get('http://localhost:3001/api/intro?type=short', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(JSON.parse(data).text);
  });
});
```

---

## 🎯 最佳实践

1. **优先使用API**：对于自我介绍和团队配置，使用3001端口API
2. **CLI作为备用**：如果API不可用，使用CLI工具
3. **服务监控**：定期检查`pm2 status`确保服务在线
4. **日志查看**：出现问题时先查看`pm2 logs`

---

## 📚 相关文档

- [系统全面评估报告.json](./系统全面评估报告.json)
- [API修复深度诊断报告.json](./API修复深度诊断报告.json)
- [问题修复完成报告.json](./问题修复完成报告.json)

---

**更新日期：** 2025-10-08  
**维护者：** 💻 技术开发·小柳


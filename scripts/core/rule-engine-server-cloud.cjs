/**
 * 规则引擎服务 - 云端优化版
 * 
 * 云端特性：
 * 1. 支持环境变量配置
 * 2. 跨域支持（CORS）
 * 3. API限流保护
 * 4. 安全加固（Helmet）
 * 5. 健康检查端点
 * 6. 优雅关闭
 * 7. 轻量化部署（减少依赖）
 * 
 * 版本：v6.1.1-cloud
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const app = express();

// ========== 环境变量配置 ==========
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

// ========== 安全中间件 ==========
// 1. Helmet - 安全头
app.use(helmet({
  contentSecurityPolicy: false, // 允许API使用
}));

// 2. CORS - 跨域配置
app.use(cors({
  origin: function(origin, callback) {
    // 允许无origin的请求（如Postman）
    if (!origin) return callback(null, true);
    
    // 检查是否在白名单中
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 3. 限流 - 防止滥用
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 限制100次
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/v1/', limiter);

// 4. JSON解析
app.use(express.json({ limit: '10mb' }));

// ========== 日志中间件 ==========
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// ========== 规则加载模块 ==========
const POLICY_DIR = path.join(__dirname, '../../policy');
let codeRules = [];
let dialogueRules = [];
let lastLoadTime = 0;
const CACHE_TTL = 300000; // 5分钟缓存

/**
 * 加载规则文件
 */
function loadRules(force = false) {
  const now = Date.now();
  
  // 缓存未过期且非强制刷新
  if (!force && codeRules.length > 0 && (now - lastLoadTime) < CACHE_TTL) {
    return;
  }
  
  try {
    console.log('📚 加载规则文件...');
    
    // 加载代码规则
    const codeFiles = [
      'core-l1.yaml',
      'quality-l2.yaml',
      'security-l3.yaml',
      'ir-032-quality-threshold.yaml',
      'sys-upgrade-l3.yaml',
      'version-management-l1.yaml',
      'data-format-l1.yaml',
      'testing-standards-l1.yaml',
    ];
    
    codeRules = [];
    for (const file of codeFiles) {
      const filePath = path.join(POLICY_DIR, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = yaml.load(content);
        if (data && data.rules) {
          codeRules.push(...data.rules);
        }
      }
    }
    
    // 加载对话规则
    const dialogueFiles = ['dialogue-l1.yaml'];
    dialogueRules = [];
    for (const file of dialogueFiles) {
      const filePath = path.join(POLICY_DIR, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = yaml.load(content);
        if (data && data.rules) {
          dialogueRules.push(...data.rules);
        }
      }
    }
    
    lastLoadTime = now;
    console.log(`✅ 规则加载完成: ${codeRules.length} 代码规则, ${dialogueRules.length} 对话规则`);
  } catch (error) {
    console.error('❌ 规则加载失败:', error);
  }
}

// 启动时加载规则
loadRules(true);

// ========== API端点 ==========

/**
 * 健康检查（云平台要求）
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: 'v6.1.1-cloud',
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: Date.now(),
    rules: {
      code: codeRules.length,
      dialogue: dialogueRules.length
    }
  });
});

/**
 * 根路径
 */
app.get('/', (req, res) => {
  res.json({
    name: '小柳智能开发助手 - 云端API',
    version: 'v6.1.1-cloud',
    description: '多终端规则引擎服务',
    endpoints: {
      health: 'GET /health',
      version: 'GET /v1/version',
      checkCode: 'POST /v1/check-code',
      checkDialogue: 'POST /v1/check-dialogue',
      rules: 'GET /v1/rules',
      intro: 'GET /v1/intro'
    },
    documentation: 'https://github.com/daxiak001/cursor-mcp'
  });
});

/**
 * 版本信息
 */
app.get('/v1/version', (req, res) => {
  try {
    const versionFile = path.join(__dirname, '../../version.json');
    if (fs.existsSync(versionFile)) {
      const version = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      res.json(version);
    } else {
      res.json({
        version: 'v6.1.1-cloud',
        releaseDate: '2025-10-08',
        environment: 'cloud'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取所有规则
 */
app.get('/v1/rules', (req, res) => {
  const type = req.query.type;
  
  if (type === 'code') {
    res.json({ rules: codeRules, count: codeRules.length });
  } else if (type === 'dialogue') {
    res.json({ rules: dialogueRules, count: dialogueRules.length });
  } else {
    res.json({
      code: { rules: codeRules, count: codeRules.length },
      dialogue: { rules: dialogueRules, count: dialogueRules.length }
    });
  }
});

/**
 * 检查代码质量
 */
app.post('/v1/check-code', (req, res) => {
  try {
    const { code, filename } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: '缺少code参数' });
    }
    
    const violations = [];
    
    // 简化的规则检查（云端轻量化）
    for (const rule of codeRules) {
      if (rule.level === 'error') {
        // 硬编码检测
        if (rule.id === 'IR-003' || rule.category === '代码质量') {
          const patterns = [
            /password\s*=\s*["'][^"']+["']/i,
            /api[_-]?key\s*=\s*["'][^"']+["']/i,
            /secret\s*=\s*["'][^"']+["']/i,
            /token\s*=\s*["'][^"']+["']/i,
          ];
          
          for (const pattern of patterns) {
            if (pattern.test(code)) {
              violations.push({
                ruleId: rule.id || 'IR-003',
                message: rule.description || '检测到硬编码的敏感信息',
                severity: 'error',
                line: code.split('\n').findIndex(line => pattern.test(line)) + 1
              });
            }
          }
        }
      }
    }
    
    res.json({
      violations,
      pass: violations.length === 0,
      filename,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('代码检查错误:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 检查对话行为
 */
app.post('/v1/check-dialogue', (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '缺少message参数' });
    }
    
    const violations = [];
    
    // 简化的对话检查
    const forbiddenPatterns = [
      { pattern: /是否需要我继续/i, rule: 'IR-031' },
      { pattern: /需要我继续吗/i, rule: 'IR-031' },
      { pattern: /要我继续吗/i, rule: 'IR-031' },
      { pattern: /请确认是否继续/i, rule: 'IR-031' },
    ];
    
    for (const { pattern, rule } of forbiddenPatterns) {
      if (pattern.test(message)) {
        violations.push({
          ruleId: rule,
          message: '禁止询问用户是否继续，应直接继续执行',
          severity: 'error'
        });
      }
    }
    
    res.json({
      violations,
      pass: violations.length === 0,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('对话检查错误:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 自我介绍
 */
app.get('/v1/intro', (req, res) => {
  const type = req.query.type || 'short';
  
  const intros = {
    short: '我是小柳智能开发助手 v6.1.1，专注于提升代码质量和开发效率。',
    full: `我是小柳智能开发助手 v6.1.1 云端版
    
🎯 核心能力：
- 148条智能规则实时检查
- 多终端统一管理
- 自动化质量门禁
- 四角色团队协作

📊 当前状态：
- 服务：正常运行
- 环境：${NODE_ENV}
- 规则：${codeRules.length}条代码规则 + ${dialogueRules.length}条对话规则

🚀 云端优势：
- 零安装，即开即用
- 实时升级，秒级生效
- 多设备自动同步
- 高可用保障`,
    version: `v6.1.1-cloud (${NODE_ENV})`
  };
  
  res.json({
    text: intros[type] || intros.short,
    version: 'v6.1.1-cloud',
    environment: NODE_ENV
  });
});

/**
 * 刷新规则（管理员接口）
 */
app.post('/v1/admin/reload-rules', (req, res) => {
  try {
    loadRules(true);
    res.json({
      success: true,
      message: '规则已重新加载',
      rules: {
        code: codeRules.length,
        dialogue: dialogueRules.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 错误处理 ==========
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: '服务器内部错误',
    message: NODE_ENV === 'development' ? err.message : '请稍后重试'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: '端点不存在',
    path: req.path,
    availableEndpoints: [
      'GET /health',
      'GET /v1/version',
      'GET /v1/rules',
      'POST /v1/check-code',
      'POST /v1/check-dialogue',
      'GET /v1/intro'
    ]
  });
});

// ========== 服务启动 ==========
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║       ☁️  小柳智能开发助手 - 云端API服务                   ║
║                                                           ║
║  版本: v6.1.1-cloud                                       ║
║  环境: ${NODE_ENV.padEnd(51)} ║
║  端口: ${PORT.toString().padEnd(51)} ║
║                                                           ║
║  代码规则: ${codeRules.length.toString().padEnd(3)} 条                                        ║
║  对话规则: ${dialogueRules.length.toString().padEnd(3)} 条                                        ║
║                                                           ║
║  核心API:                                                 ║
║    GET  /health           - 健康检查                      ║
║    GET  /v1/version       - 版本信息                      ║
║    GET  /v1/rules         - 获取规则                      ║
║    POST /v1/check-code    - 检查代码                      ║
║    POST /v1/check-dialogue - 检查对话                     ║
║    GET  /v1/intro         - 自我介绍                      ║
║                                                           ║
║  🚀 云端服务已就绪，可接受多终端访问                       ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  console.log(`[${new Date().toISOString()}] 服务启动成功`);
  console.log(`[${new Date().toISOString()}] 监听地址: http://0.0.0.0:${PORT}`);
  if (NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] 本地测试: http://localhost:${PORT}`);
  }
});

// ========== 优雅关闭 ==========
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，准备优雅关闭...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n收到SIGINT信号，准备优雅关闭...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

// ========== 错误处理 ==========
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

module.exports = app;


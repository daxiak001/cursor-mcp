/**
 * 自我介绍API独立服务
 * 解决PM2环境下的兼容性问题
 */

const express = require('express');
const SelfIntroduction = require('../tools/self-intro.cjs');
const monitor = require('./monitor-logger.cjs');

const app = express();
const PORT = 3001;

// 自我介绍API
app.get('/api/intro', (req, res) => {
  const startTime = Date.now();
  try {
    const type = req.query.type || 'full';
    const intro = new SelfIntroduction();
    
    let response;
    
    switch (type) {
      case 'short':
        response = { text: intro.getShortIntro() };
        break;
      case 'team':
        response = { text: intro.getTeamIntro() };
        break;
      case 'version':
        response = { text: intro.getVersionInfo() };
        break;
      case 'json':
        response = intro.getTeamConfig();
        break;
      default:
        response = { text: intro.getFullIntro() };
    }
    
    const duration = Date.now() - startTime;
    monitor.logApiCall('/api/intro', 'GET', duration, 200, true);
    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    monitor.logError('api-intro-server', error, { endpoint: '/api/intro' });
    monitor.logApiCall('/api/intro', 'GET', duration, 500, false, error);
    res.status(500).json({ error: error.message });
  }
});

// 团队配置API
app.get('/api/team/config', (req, res) => {
  const startTime = Date.now();
  try {
    const intro = new SelfIntroduction();
    const result = intro.getTeamConfig();
    
    const duration = Date.now() - startTime;
    monitor.logApiCall('/api/team/config', 'GET', duration, 200, true);
    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    monitor.logError('api-intro-server', error, { endpoint: '/api/team/config' });
    monitor.logApiCall('/api/team/config', 'GET', duration, 500, false, error);
    res.status(500).json({ error: error.message });
  }
});

// 角色信息API
app.get('/api/team/role/:roleKey', (req, res) => {
  const startTime = Date.now();
  try {
    const { roleKey } = req.params;
    const intro = new SelfIntroduction();
    const roleInfo = intro.getRoleInfo(roleKey);
    
    const duration = Date.now() - startTime;
    monitor.logApiCall('/api/team/role/:roleKey', 'GET', duration, 200, true);
    res.json({ role: roleInfo });
  } catch (error) {
    const duration = Date.now() - startTime;
    monitor.logError('api-intro-server', error, { 
      endpoint: '/api/team/role/:roleKey', 
      roleKey: req.params.roleKey 
    });
    monitor.logApiCall('/api/team/role/:roleKey', 'GET', duration, 500, false, error);
    res.status(500).json({ error: error.message });
  }
});

// 启动服务
app.listen(PORT, () => {
  // 记录服务启动
  monitor.logHealthCheck('api-intro-server', 'healthy', {
    port: PORT,
    endpoints: ['/api/intro', '/api/team/config', '/api/team/role/:roleKey']
  });
  
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         自我介绍API服务已启动 (独立服务)                   ║
║                                                           ║
║  端口: ${PORT}                                             ║
║                                                           ║
║  可用API:                                                 ║
║    GET  /api/intro?type=short    - 简短介绍               ║
║    GET  /api/intro?type=team     - 团队介绍               ║
║    GET  /api/intro?type=version  - 版本信息               ║
║    GET  /api/intro               - 完整介绍               ║
║    GET  /api/team/config         - 团队配置               ║
║    GET  /api/team/role/:roleKey  - 角色信息               ║
║                                                           ║
║  📊 监测: 已启用完整API监测                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
  console.log(`[自我介绍API] 服务已启动: http://localhost:${PORT}`);
  console.log(`[自我介绍API] 测试: curl http://localhost:${PORT}/api/intro?type=short`);
  console.log(`[自我介绍API] 监测: logs/monitor.log`);
  console.log('');
});

// 定期健康检查（每5分钟）
setInterval(() => {
  try {
    monitor.logHealthCheck('api-intro-server', 'healthy', {
      port: PORT,
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed / 1024 / 1024
    });
  } catch (error) {
    monitor.logHealthCheck('api-intro-server', 'unhealthy', {
      error: error.message
    });
  }
}, 5 * 60 * 1000);


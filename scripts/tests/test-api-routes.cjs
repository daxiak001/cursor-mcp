/**
 * API路由测试脚本
 * 用于诊断API路由注册问题
 */

const express = require('express');
const SelfIntroduction = require('../tools/self-intro.cjs');

const app = express();
const PORT = 3001; // 使用不同端口避免冲突

console.log('========================================');
console.log('🔍 API路由诊断测试');
console.log('========================================\n');

// 测试1：验证SelfIntroduction模块
console.log('📦 测试1: 验证SelfIntroduction模块加载...');
try {
  const intro = new SelfIntroduction();
  const shortIntro = intro.getShortIntro();
  console.log('✅ SelfIntroduction模块正常');
  console.log(`   输出: ${shortIntro}`);
} catch (error) {
  console.error('❌ SelfIntroduction模块加载失败:', error.message);
  process.exit(1);
}

console.log('\n📡 测试2: 注册API路由...');

// 注册自我介绍API
app.get('/api/intro', (req, res) => {
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
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 注册团队配置API
app.get('/api/team/config', (req, res) => {
  try {
    const intro = new SelfIntroduction();
    res.json(intro.getTeamConfig());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 注册角色信息API
app.get('/api/team/role/:roleKey', (req, res) => {
  try {
    const { roleKey } = req.params;
    const intro = new SelfIntroduction();
    const roleInfo = intro.getRoleInfo(roleKey);
    
    res.json({ role: roleInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

console.log('✅ API路由已注册');

// 列出所有路由
console.log('\n📋 已注册的路由：');
console.log('   GET /api/intro');
console.log('   GET /api/team/config');
console.log('   GET /api/team/role/:roleKey');

// 启动测试服务器
console.log(`\n🚀 测试3: 启动测试服务器 (端口${PORT})...`);
const server = app.listen(PORT, async () => {
  console.log(`✅ 测试服务器启动成功\n`);
  
  // 测试API调用
  console.log('🧪 测试4: 调用API端点...\n');
  
  const http = require('http');
  
  const testAPI = (endpoint, description) => {
    return new Promise((resolve) => {
      http.get(`http://localhost:${PORT}${endpoint}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`✅ ${description}`);
            console.log(`   响应: ${data.substring(0, 100)}...`);
            resolve(true);
          } else {
            console.log(`❌ ${description} - 状态码: ${res.statusCode}`);
            resolve(false);
          }
        });
      }).on('error', (error) => {
        console.log(`❌ ${description} - 错误: ${error.message}`);
        resolve(false);
      });
    });
  };
  
  const results = [];
  
  results.push(await testAPI('/api/intro?type=short', '自我介绍API (short)'));
  results.push(await testAPI('/api/intro?type=team', '自我介绍API (team)'));
  results.push(await testAPI('/api/team/config', '团队配置API'));
  results.push(await testAPI('/api/team/role/developer', '角色信息API'));
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n========================================');
  console.log(`📊 测试结果: ${passed}/${total} 通过`);
  console.log('========================================\n');
  
  if (passed === total) {
    console.log('🎉 所有API测试通过！API路由逻辑正常。');
    console.log('   问题可能在主服务器的启动配置中。');
  } else {
    console.log('⚠️  部分API测试失败，需要检查路由逻辑。');
  }
  
  // 关闭服务器
  server.close();
  process.exit(passed === total ? 0 : 1);
});


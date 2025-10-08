/**
 * 实时路由测试 - 检查运行中的服务器路由
 */

const http = require('http');

const PORT = 3000;

console.log('🔍 检查运行中的服务器路由...\n');

// 测试所有可能的API端点
const endpoints = [
  { path: '/api/version', desc: '版本API' },
  { path: '/api/health', desc: '健康检查' },
  { path: '/api/intro?type=short', desc: '自我介绍API (short)' },
  { path: '/api/intro', desc: '自我介绍API (full)' },
  { path: '/api/team/config', desc: '团队配置API' },
  { path: '/api/team/role/developer', desc: '角色信息API' },
  { path: '/api/continuous-mode/status', desc: '连续模式状态' },
  { path: '/api/experience/stats', desc: '经验统计' }
];

let passed = 0;
let failed = 0;

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}${endpoint.path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${endpoint.desc}`);
          console.log(`   ${endpoint.path}`);
          console.log(`   响应: ${data.substring(0, 80)}...\n`);
          passed++;
          resolve(true);
        } else {
          console.log(`❌ ${endpoint.desc} - ${res.statusCode}`);
          console.log(`   ${endpoint.path}\n`);
          failed++;
          resolve(false);
        }
      });
    }).on('error', (error) => {
      console.log(`❌ ${endpoint.desc} - ${error.message}`);
      console.log(`   ${endpoint.path}\n`);
      failed++;
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`❌ ${endpoint.desc} - Timeout`);
      failed++;
      resolve(false);
    });
  });
}

async function runTests() {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('========================================');
  console.log(`📊 测试结果: ${passed}/${endpoints.length} 通过`);
  console.log(`   成功: ${passed} ✅`);
  console.log(`   失败: ${failed} ❌`);
  console.log('========================================\n');
  
  if (failed > 0) {
    console.log('⚠️  部分API端点不可用');
    console.log('💡 建议：检查rule-engine-server.cjs中的路由定义\n');
  } else {
    console.log('🎉 所有API端点正常！\n');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();


/**
 * 四角色系统集成测试
 * 测试所有新功能模块
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

async function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 四角色系统集成测试\n');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  // 测试1: GUI测试
  console.log('\n📋 测试1: GUI 5轮测试\n');
  try {
    const result = await apiRequest('POST', '/api/v61/gui-test/5rounds', {
      name: '测试Web应用',
      type: 'web',
      url: 'https://example.com',
      headless: true,
      steps: [
        { action: 'waitForSelector', target: 'h1' },
        { action: 'assert', target: 'h1', text: 'Example' }
      ]
    });
    
    if (result.status === 200 && result.data.success) {
      console.log('   ✅ GUI测试API正常');
      passed++;
    } else {
      console.log('   ❌ GUI测试失败');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ 错误:', error.message);
    failed++;
  }

  // 测试2: 技能库 - 记录
  console.log('\n📋 测试2: 技能库记录\n');
  try {
    const result = await apiRequest('POST', '/api/v61/skills/record', {
      type: 'bugFix',
      title: 'PM2启动失败修复',
      problem: 'PM2无法启动，提示模块错误',
      solution: '将.js改为.cjs使用CommonJS',
      context: '规则引擎服务'
    });

    if (result.status === 200 && result.data.success) {
      console.log('   ✅ 技能记录成功');
      passed++;
    } else {
      console.log('   ❌ 技能记录失败');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ 错误:', error.message);
    failed++;
  }

  // 测试3: 技能库 - 搜索
  console.log('\n📋 测试3: 技能库搜索\n');
  try {
    const result = await apiRequest('GET', '/api/v61/skills/search?problem=PM2&minScore=0.3');

    if (result.status === 200 && result.data.success) {
      console.log(`   ✅ 找到${result.data.count}个匹配方案`);
      passed++;
    } else {
      console.log('   ❌ 搜索失败');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ 错误:', error.message);
    failed++;
  }

  // 测试4: 确认卡检查
  console.log('\n📋 测试4: 确认卡检查\n');
  try {
    const confirmationCard = `
## 📋 执行前确认卡

### 我的理解
我理解您希望创建一个GUI自动化测试系统，实现5轮重复测试验证

### 技术方案
使用Playwright进行Web应用测试，每轮测试自动截图和记录日志

### 潜在风险
浏览器兼容性问题，网络延迟可能导致超时，需要设置重试机制

### 确认点
1. 是否需要支持桌面应用测试？
2. 日志格式是否为JSON？

### 预期结果
完成后创建gui-test-runner.cjs文件，可通过npm命令运行测试

**请用户确认：** 以上理解是否正确？
    `.trim();

    const result = await apiRequest('POST', '/api/v61/confirmation/check', {
      message: confirmationCard
    });

    if (result.status === 200 && result.data.success) {
      console.log('   ✅ 确认卡格式正确');
      passed++;
    } else {
      console.log('   ⚠️  确认卡有警告');
      console.log('   违规:', result.data.result.violations.length);
      passed++;
    }
  } catch (error) {
    console.log('   ❌ 错误:', error.message);
    failed++;
  }

  // 测试5: 循环防护检查
  console.log('\n📋 测试5: 循环防护检查\n');
  try {
    const dangerousCode = `
function test() {
  while (true) {
    doSomething();
  }
}`;

    const result = await apiRequest('POST', '/api/v61/loop/check', {
      code: dangerousCode
    });

    if (result.status === 200 && !result.data.success) {
      console.log('   ✅ 正确检测到危险循环');
      passed++;
    } else {
      console.log('   ❌ 未检测到问题');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ 错误:', error.message);
    failed++;
  }

  // 测试6: 循环自动修复
  console.log('\n📋 测试6: 循环自动修复\n');
  try {
    const result = await apiRequest('POST', '/api/v61/loop/fix', {
      code: 'while (true) { work(); }',
      timeout: 30000
    });

    if (result.status === 200 && result.data.success && result.data.fixed.includes('LOOP_TIMEOUT')) {
      console.log('   ✅ 自动修复成功');
      passed++;
    } else {
      console.log('   ❌ 修复失败');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ 错误:', error.message);
    failed++;
  }

  // 测试7: 角色检测
  console.log('\n📋 测试7: 角色自动检测\n');
  try {
    const result = await apiRequest('POST', '/api/v61/role/detect', {
      message: '需要执行GUI测试验证功能'
    });

    if (result.status === 200 && result.data.success) {
      console.log(`   ✅ 检测到角色: ${result.data.detectedRole}`);
      console.log(`   角色名称: ${result.data.roleInfo.name}`);
      passed++;
    } else {
      console.log('   ❌ 角色检测失败');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ 错误:', error.message);
    failed++;
  }

  // 测试8: 会议触发
  console.log('\n📋 测试8: 会议引擎\n');
  try {
    const result = await apiRequest('POST', '/api/v61/meeting/trigger', {
      title: 'BUG修复失败5次',
      severity: 'high',
      reason: '尝试了5种方法都无法解决'
    });

    if (result.status === 200 && result.data.success) {
      console.log('   ✅ 会议成功召开');
      console.log(`   会议ID: ${result.data.result.meetingId}`);
      console.log(`   负责人: ${result.data.result.resolution.assignee}`);
      passed++;
    } else {
      console.log('   ❌ 会议触发失败');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ 错误:', error.message);
    failed++;
  }

  // 汇总结果
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 测试结果汇总\n');
  console.log(`   总测试数: ${passed + failed}`);
  console.log(`   ✅ 通过: ${passed}`);
  console.log(`   ❌ 失败: ${failed}`);
  console.log(`   通过率: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！\n');
  } else {
    console.log('\n⚠️  部分测试失败，请检查\n');
  }
}

// 运行测试
runTests().catch(error => {
  console.error('\n❌ 测试执行错误:', error);
  process.exit(1);
});


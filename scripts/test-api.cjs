/**
 * API测试脚本
 * 测试SQLite版规则引擎的所有API端点
 */

const http = require('http');

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
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

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runAPITests() {
  console.log('🧪 开始API测试\n');
  
  let passed = 0;
  let failed = 0;

  try {
    // 测试1: 健康检查
    console.log('📌 测试1: GET /api/health');
    const health = await apiRequest('GET', '/api/health');
    if (health.status === 200 && health.data.status === 'ok') {
      console.log(`   ✅ 状态: ${health.data.status}`);
      console.log(`   模式: ${health.data.mode}`);
      console.log(`   规则总数: ${health.data.rules.total}`);
      console.log(`   数据库: ${health.data.database}\n`);
      passed++;
    } else {
      console.log('   ❌ 健康检查失败\n');
      failed++;
    }

    // 测试2: 检查代码质量
    console.log('📌 测试2: POST /api/check-code');
    const codeCheck = await apiRequest('POST', '/api/check-code', {
      code: 'const password = "123456"; const token = "abc123";',
      filePath: 'test.js'
    });
    if (codeCheck.status === 200) {
      console.log(`   ✅ 通过: ${codeCheck.data.passed}`);
      console.log(`   违规数: ${codeCheck.data.summary.total}`);
      if (codeCheck.data.violations.length > 0) {
        console.log(`   第一个违规: ${codeCheck.data.violations[0].ruleId} - ${codeCheck.data.violations[0].message}`);
      }
      console.log('');
      passed++;
    } else {
      console.log('   ❌ 代码检查失败\n');
      failed++;
    }

    // 测试3: 检查对话行为
    console.log('📌 测试3: POST /api/check-dialogue');
    const dialogueCheck = await apiRequest('POST', '/api/check-dialogue', {
      text: '请问你需要这个功能吗？我们可以讨论一下。'
    });
    if (dialogueCheck.status === 200) {
      console.log(`   ✅ 通过: ${dialogueCheck.data.passed}`);
      console.log(`   违规数: ${dialogueCheck.data.summary.total}`);
      if (dialogueCheck.data.violations.length > 0) {
        console.log(`   第一个违规: ${dialogueCheck.data.violations[0].ruleId} - ${dialogueCheck.data.violations[0].message}`);
      }
      console.log('');
      passed++;
    } else {
      console.log('   ❌ 对话检查失败\n');
      failed++;
    }

    // 测试4: 获取所有规则
    console.log('📌 测试4: GET /api/rules');
    const rules = await apiRequest('GET', '/api/rules');
    if (rules.status === 200 && rules.data.success) {
      console.log(`   ✅ 规则数量: ${rules.data.rules.length}`);
      if (rules.data.rules.length > 0) {
        console.log(`   示例规则: ${rules.data.rules[0].id} - ${rules.data.rules[0].title}\n`);
      }
      passed++;
    } else {
      console.log('   ❌ 获取规则失败\n');
      failed++;
    }

    // 测试5: 获取单个规则
    console.log('📌 测试5: GET /api/rules/IR-003');
    const rule = await apiRequest('GET', '/api/rules/IR-003');
    if (rule.status === 200 && rule.data.success) {
      console.log(`   ✅ 规则ID: ${rule.data.rule.id}`);
      console.log(`   标题: ${rule.data.rule.title}`);
      console.log(`   类别: ${rule.data.rule.category}`);
      console.log(`   优先级: ${rule.data.rule.priority}\n`);
      passed++;
    } else {
      console.log('   ❌ 获取规则失败\n');
      failed++;
    }

    // 测试6: 重新加载规则
    console.log('📌 测试6: POST /api/reload-rules');
    const reload = await apiRequest('POST', '/api/reload-rules');
    if (reload.status === 200 && reload.data.success) {
      console.log(`   ✅ ${reload.data.message}`);
      console.log(`   规则数: code=${reload.data.counts.code}, dialogue=${reload.data.counts.dialogue}, workflow=${reload.data.counts.workflow}\n`);
      passed++;
    } else {
      console.log('   ❌ 重新加载失败\n');
      failed++;
    }

    // 测试7: 获取审计日志
    console.log('📌 测试7: GET /api/audit-logs');
    const logs = await apiRequest('GET', '/api/audit-logs');
    if (logs.status === 200 && logs.data.success) {
      console.log(`   ✅ 日志数量: ${logs.data.logs.length}`);
      if (logs.data.logs.length > 0) {
        console.log(`   最新日志: ${logs.data.logs[0].action} - ${logs.data.logs[0].target}\n`);
      }
      passed++;
    } else {
      console.log('   ❌ 获取日志失败\n');
      failed++;
    }

    // 测试8: 搜索经验
    console.log('📌 测试8: GET /api/lessons/search?keyword=SQLite');
    const lessons = await apiRequest('GET', '/api/lessons/search?keyword=SQLite');
    if (lessons.status === 200 && lessons.data.success) {
      console.log(`   ✅ 搜索结果: ${lessons.data.lessons.length}条`);
      if (lessons.data.lessons.length > 0) {
        console.log(`   第一条: ${lessons.data.lessons[0].problem}\n`);
      }
      passed++;
    } else {
      console.log('   ❌ 搜索经验失败\n');
      failed++;
    }

    // 测试9: 获取配置
    console.log('📌 测试9: GET /api/config/execution_rate_target');
    const config = await apiRequest('GET', '/api/config/execution_rate_target');
    if (config.status === 200 && config.data.success) {
      console.log(`   ✅ 配置键: ${config.data.key}`);
      console.log(`   配置值: ${config.data.value} (${typeof config.data.value})\n`);
      passed++;
    } else {
      console.log('   ❌ 获取配置失败\n');
      failed++;
    }

    // 测试10: 质量门禁
    console.log('📌 测试10: POST /api/quality-gate');
    const gate = await apiRequest('POST', '/api/quality-gate', {
      code: 'const secret_key = "my-secret";',
      dialogue: '你觉得这样可以吗？'
    });
    if (gate.status === 200) {
      console.log(`   ✅ 门禁通过: ${gate.data.passed}`);
      console.log(`   违规统计: core=${gate.data.summary.core}, high=${gate.data.summary.high}, total=${gate.data.summary.total}\n`);
      passed++;
    } else {
      console.log('   ❌ 质量门禁失败\n');
      failed++;
    }

  } catch (error) {
    console.error('❌ 测试异常:', error.message);
    failed++;
  }

  // 总结
  console.log('━'.repeat(50));
  console.log(`\n📊 API测试总结:`);
  console.log(`   ✅ 通过: ${passed}/10`);
  console.log(`   ❌ 失败: ${failed}/10`);
  console.log(`   成功率: ${Math.round((passed / 10) * 100)}%\n`);

  if (failed === 0) {
    console.log('🎉 所有API测试通过！\n');
    process.exit(0);
  } else {
    console.log('⚠️  部分API测试失败\n');
    process.exit(1);
  }
}

// 等待服务器启动后执行测试
setTimeout(() => {
  runAPITests();
}, 2000);


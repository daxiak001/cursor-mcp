/**
 * 完整集成测试
 * 测试Express规则引擎与MCP集成的完整流程
 */

const http = require('http');

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runFullIntegrationTest() {
  console.log('🔬 完整集成测试 - Express + SQLite 规则引擎\n');
  console.log('━'.repeat(60));
  
  let passed = 0;
  let failed = 0;

  try {
    // ==================== 场景1: 代码质量检查流程 ====================
    console.log('\n📋 场景1: 代码质量检查流程\n');
    
    console.log('步骤1.1: 检查违规代码');
    const badCode = `
      const password = "admin123";
      const api_key = "sk-abc123def456";
      function getUserData() {
        const token = "Bearer xyz789";
        return fetch('https://api.example.com', {
          headers: { 'Authorization': token }
        });
      }
    `;
    
    const codeCheck1 = await apiRequest('POST', '/api/check-code', {
      code: badCode,
      filePath: 'src/auth.js'
    });
    
    if (!codeCheck1.data.passed && codeCheck1.data.violations.length > 0) {
      console.log(`   ✅ 检测到${codeCheck1.data.violations.length}个违规`);
      console.log(`   核心违规: ${codeCheck1.data.summary.core}个`);
      passed++;
    } else {
      console.log('   ❌ 未检测到违规');
      failed++;
    }

    console.log('\n步骤1.2: 检查合规代码');
    const goodCode = `
      import { getConfig } from './config';
      
      async function getUserData() {
        const apiKey = await getConfig('API_KEY');
        return fetch('https://api.example.com', {
          headers: { 'Authorization': apiKey }
        });
      }
    `;
    
    const codeCheck2 = await apiRequest('POST', '/api/check-code', {
      code: goodCode,
      filePath: 'src/auth-fixed.js'
    });
    
    if (codeCheck2.data.passed || codeCheck2.data.violations.length === 0) {
      console.log('   ✅ 代码通过检查');
      passed++;
    } else {
      console.log(`   ❌ 代码未通过检查: ${codeCheck2.data.violations.length}个违规`);
      failed++;
    }

    // ==================== 场景2: 对话行为检查流程 ====================
    console.log('\n📋 场景2: 对话行为检查流程\n');
    
    console.log('步骤2.1: 检查违规对话');
    const badDialogue = `
      你好！我理解你的需求是实现用户认证功能。
      
      请问你需要哪种认证方式？JWT还是Session？
      你觉得我们应该先实现登录还是注册？
      等待你的回复后我再开始开发。
    `;
    
    const dialogueCheck1 = await apiRequest('POST', '/api/check-dialogue', {
      text: badDialogue
    });
    
    if (!dialogueCheck1.data.passed && dialogueCheck1.data.violations.length > 0) {
      console.log(`   ✅ 检测到${dialogueCheck1.data.violations.length}个违规`);
      console.log(`   违规类型: ${dialogueCheck1.data.violations.map(v => v.ruleId).join(', ')}`);
      passed++;
    } else {
      console.log('   ❌ 未检测到违规');
      failed++;
    }

    console.log('\n步骤2.2: 检查合规对话');
    const goodDialogue = `
      我的理解：需求是实现用户认证功能。
      
      方案：采用JWT认证方式，同时实现登录和注册功能。
      
      风险：需要处理Token过期和刷新机制。
      
      确认：立即开始开发，预计1小时完成。
    `;
    
    const dialogueCheck2 = await apiRequest('POST', '/api/check-dialogue', {
      text: goodDialogue
    });
    
    if (dialogueCheck2.data.passed || dialogueCheck2.data.violations.length === 0) {
      console.log('   ✅ 对话通过检查');
      passed++;
    } else {
      console.log(`   ❌ 对话未通过检查: ${dialogueCheck2.data.violations.length}个违规`);
      failed++;
    }

    // ==================== 场景3: 质量门禁 ====================
    console.log('\n📋 场景3: 质量门禁（代码+对话）\n');
    
    const gateCheck = await apiRequest('POST', '/api/quality-gate', {
      code: 'const validCode = getEnv("API_KEY");',
      dialogue: '我的理解是：需要获取API密钥。方案：从环境变量读取。'
    });
    
    if (gateCheck.data.passed) {
      console.log('   ✅ 质量门禁通过');
      console.log(`   总违规数: ${gateCheck.data.summary.total}`);
      passed++;
    } else {
      console.log(`   ⚠️  质量门禁未通过: ${gateCheck.data.summary.core}个核心违规`);
      if (gateCheck.data.summary.total === 0) {
        passed++;
      } else {
        failed++;
      }
    }

    // ==================== 场景4: 规则管理 ====================
    console.log('\n📋 场景4: 规则管理\n');
    
    console.log('步骤4.1: 获取所有规则');
    const allRules = await apiRequest('GET', '/api/rules');
    if (allRules.data.success && allRules.data.rules.length > 0) {
      console.log(`   ✅ 获取到${allRules.data.rules.length}条规则`);
      passed++;
    } else {
      console.log('   ❌ 获取规则失败');
      failed++;
    }

    console.log('\n步骤4.2: 按类别查询规则');
    const codeRules = await apiRequest('GET', '/api/rules?category=code');
    if (codeRules.data.success && codeRules.data.rules.length > 0) {
      console.log(`   ✅ 获取到${codeRules.data.rules.length}条代码规则`);
      passed++;
    } else {
      console.log('   ❌ 查询代码规则失败');
      failed++;
    }

    // ==================== 场景5: 审计日志 ====================
    console.log('\n📋 场景5: 审计日志追踪\n');
    
    const auditLogs = await apiRequest('GET', '/api/audit-logs');
    if (auditLogs.data.success && auditLogs.data.logs.length > 0) {
      console.log(`   ✅ 获取到${auditLogs.data.logs.length}条审计日志`);
      console.log(`   最新操作: ${auditLogs.data.logs[0].action}`);
      console.log(`   目标: ${auditLogs.data.logs[0].target}`);
      passed++;
    } else {
      console.log('   ❌ 获取审计日志失败');
      failed++;
    }

    // ==================== 场景6: 经验库 ====================
    console.log('\n📋 场景6: 经验库检索\n');
    
    const lessons = await apiRequest('GET', '/api/lessons/search?keyword=' + encodeURIComponent('硬编码'));
    if (lessons.data.success) {
      console.log(`   ✅ 搜索到${lessons.data.lessons.length}条相关经验`);
      passed++;
    } else {
      console.log('   ❌ 经验检索失败');
      failed++;
    }

    // ==================== 场景7: 配置管理 ====================
    console.log('\n📋 场景7: 配置持久化\n');
    
    const config = await apiRequest('GET', '/api/config/execution_rate_target');
    if (config.data.success && config.data.value === 95) {
      console.log(`   ✅ 执行率目标: ${config.data.value}%`);
      passed++;
    } else {
      console.log('   ❌ 配置读取失败');
      failed++;
    }

    // ==================== 场景8: 规则热重载 ====================
    console.log('\n📋 场景8: 规则热重载\n');
    
    const reload = await apiRequest('POST', '/api/reload-rules');
    if (reload.data.success) {
      console.log('   ✅ 规则重新加载成功');
      console.log(`   当前规则数: ${reload.data.counts.code + reload.data.counts.dialogue + reload.data.counts.workflow}条`);
      passed++;
    } else {
      console.log('   ❌ 规则重载失败');
      failed++;
    }

  } catch (error) {
    console.error('\n❌ 测试异常:', error.message);
    failed++;
  }

  // ==================== 测试总结 ====================
  console.log('\n' + '━'.repeat(60));
  console.log('\n📊 完整集成测试总结\n');
  console.log(`   ✅ 通过: ${passed}/11 场景`);
  console.log(`   ❌ 失败: ${failed}/11 场景`);
  console.log(`   成功率: ${Math.round((passed / 11) * 100)}%`);
  
  console.log('\n🔍 测试覆盖范围:');
  console.log('   ✓ 代码质量检查');
  console.log('   ✓ 对话行为检查');
  console.log('   ✓ 质量门禁');
  console.log('   ✓ 规则管理');
  console.log('   ✓ 审计日志');
  console.log('   ✓ 经验库');
  console.log('   ✓ 配置持久化');
  console.log('   ✓ 规则热重载');

  if (failed === 0) {
    console.log('\n🎉 所有集成测试通过！系统已就绪！\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分集成测试失败，请检查日志\n');
    process.exit(1);
  }
}

runFullIntegrationTest();


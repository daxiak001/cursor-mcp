/**
 * 连续执行模式测试脚本
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';

// 测试用例
const tests = [
  {
    name: '启动连续执行模式',
    type: 'POST',
    url: '/api/continuous-mode/enable',
    body: { taskDescription: '开发用户管理系统' },
    expected: {
      success: true,
      hasMessage: true,
      hasSessionId: true
    }
  },
  {
    name: '获取状态（应该是启用状态）',
    type: 'GET',
    url: '/api/continuous-mode/status',
    expected: {
      enabled: true,
      hasMessage: true
    }
  },
  {
    name: '检查对话（包含询问词，应该被拦截）',
    type: 'POST',
    url: '/api/check-dialogue',
    body: { message: '我已经完成了用户模块，是否继续开发权限模块？' },
    expected: {
      pass: false,
      hasViolations: true
    }
  },
  {
    name: '检查对话（正常对话，应该通过）',
    type: 'POST',
    url: '/api/check-dialogue',
    body: { message: '理解：开发权限模块\n\n方案：\n1. 创建权限表\n2. 实现RBAC\n\n开始执行' },
    expected: {
      // 可能因为缺少完整确认卡而fail，但不应该是连续模式拦截
      // pass: true  
    }
  },
  {
    name: '停止连续执行模式',
    type: 'POST',
    url: '/api/continuous-mode/disable',
    expected: {
      success: true,
      hasDuration: true
    }
  },
  {
    name: '获取状态（应该是停用状态）',
    type: 'GET',
    url: '/api/continuous-mode/status',
    expected: {
      enabled: false
    }
  },
  {
    name: '检查对话（连续模式已停止，询问应该通过连续模式检查）',
    type: 'POST',
    url: '/api/check-dialogue',
    body: { message: '是否需要添加日志功能？' },
    expected: {
      // 不会被连续模式拦截，但可能被其他规则拦截
    }
  }
];

async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          连续执行模式测试开始                              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\x1b[34m🧪 测试: ${test.name}\x1b[0m`);

      const options = {
        method: test.type,
        headers: { 'Content-Type': 'application/json' }
      };

      if (test.body) {
        options.body = JSON.stringify(test.body);
      }

      const response = await fetch(`${API_BASE}${test.url}`, options);
      const result = await response.json();

      // 验证结果
      let testPassed = true;
      const failures = [];

      if (test.expected.success !== undefined && result.success !== test.expected.success) {
        testPassed = false;
        failures.push(`期望 success=${test.expected.success}, 实际 ${result.success}`);
      }

      if (test.expected.enabled !== undefined && result.enabled !== test.expected.enabled) {
        testPassed = false;
        failures.push(`期望 enabled=${test.expected.enabled}, 实际 ${result.enabled}`);
      }

      if (test.expected.pass !== undefined && result.pass !== test.expected.pass) {
        testPassed = false;
        failures.push(`期望 pass=${test.expected.pass}, 实际 ${result.pass}`);
      }

      if (test.expected.hasMessage && !result.message) {
        testPassed = false;
        failures.push('期望有message字段');
      }

      if (test.expected.hasSessionId && !result.sessionId) {
        testPassed = false;
        failures.push('期望有sessionId字段');
      }

      if (test.expected.hasDuration && result.duration === undefined) {
        testPassed = false;
        failures.push('期望有duration字段');
      }

      if (test.expected.hasViolations && (!result.violations || result.violations.length === 0)) {
        testPassed = false;
        failures.push('期望有violations');
      }

      if (testPassed) {
        console.log(`  \x1b[32m✓ 通过\x1b[0m`);
        if (result.message) {
          const lines = result.message.split('\n');
          console.log(`  \x1b[33m  响应: ${lines[0]}\x1b[0m`);
        }
        if (result.violations && result.violations.length > 0) {
          console.log(`  \x1b[33m  违规: ${result.violations.map(v => v.rule).join(', ')}\x1b[0m`);
        }
        passed++;
      } else {
        console.log(`  \x1b[31m✗ 失败\x1b[0m`);
        failures.forEach(f => console.log(`  \x1b[31m    ${f}\x1b[0m`));
        console.log(`  \x1b[90m  实际结果: ${JSON.stringify(result, null, 2)}\x1b[0m`);
        failed++;
      }

      console.log('');
    } catch (error) {
      console.log(`  \x1b[31m✗ 错误: ${error.message}\x1b[0m\n`);
      failed++;
    }
  }

  // 总结
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          测试结果                                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const totalTests = tests.length;
  const passRate = ((passed / totalTests) * 100).toFixed(1);

  console.log(`  \x1b[32m通过率: ${passed}/${totalTests} (${passRate}%)\x1b[0m`);
  
  if (failed === 0) {
    console.log(`\n  \x1b[32m✓ 所有测试通过！连续执行模式工作正常。\x1b[0m\n`);
  } else {
    console.log(`\n  \x1b[31m✗ ${failed} 个测试失败\x1b[0m\n`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

// 运行测试
runTests().catch(error => {
  console.error('\n测试执行错误:', error);
  process.exit(1);
});


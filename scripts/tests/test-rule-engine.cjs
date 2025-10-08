/**
 * 规则引擎测试脚本
 * 测试代码质量检查和对话行为检查
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

// 测试用例
const testCases = {
  codeQuality: [
    {
      name: '硬编码检测 - 应该失败',
      code: `
const config = {
  password: "mypassword123",
  apiKey: "sk-1234567890abcdef"
};
      `,
      expectedPass: false,
      expectedViolations: ['IR-003'],
    },
    {
      name: '函数长度检测 - 应该警告',
      code: `
function veryLongFunction() {
  let result = 0;
  ${'  result += 1;\n'.repeat(60)}
  return result;
}
      `,
      expectedPass: true, // warn不算失败
      expectedViolations: ['IR-005'],
    },
    {
      name: '正常代码 - 应该通过',
      code: `
const config = {
  password: process.env.DB_PASSWORD,
  apiKey: process.env.API_KEY
};

function calculateSum(a, b) {
  return a + b;
}
      `,
      expectedPass: true,
      expectedViolations: [],
    },
  ],
  
  dialogue: [
    {
      name: '询问用户检测 - 应该失败',
      message: '我已经理解了你的需求，请确认是否开始执行？',
      expectedPass: false,
      expectedViolations: ['SIL-003'],
    },
    {
      name: '等待用户检测 - 应该失败',
      message: '代码已经写好了，等待你的测试结果告诉我。',
      expectedPass: false,
      expectedViolations: ['SIL-004'],
    },
    {
      name: '缺少理解确认 - 应该失败（缺少确认卡）',
      message: '好的，我现在开始执行任务。',
      expectedPass: false, // IR-031是error级别，会失败
      expectedViolations: ['IR-031', 'IR-001'],
    },
    {
      name: '缺少确认卡 - 应该失败',
      message: '我理解你要做的是重构代码，现在开始执行。',
      expectedPass: false,
      expectedViolations: ['IR-031'],
    },
    {
      name: '正常输出 - 应该通过',
      message: `
## 理解确认

我的理解：你需要优化数据库查询性能

## 方案

1. 添加索引
2. 优化查询语句
3. 使用缓存

## 风险

- 索引可能占用额外空间
- 缓存可能导致数据不一致

## 确认点

- 索引字段选择是否正确
- 缓存过期时间设置

现在开始执行。
      `,
      expectedPass: true,
      expectedViolations: [],
    },
  ],
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function testAPI(url, data, testCase) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  } catch (error) {
    log(colors.red, `  ✗ API调用失败: ${error.message}`);
    return null;
  }
}

async function runTests() {
  log(colors.blue, '\n╔═══════════════════════════════════════════════════════════╗');
  log(colors.blue, '║              规则引擎测试开始                              ║');
  log(colors.blue, '╚═══════════════════════════════════════════════════════════╝\n');
  
  let totalTests = 0;
  let passedTests = 0;
  
  // 1. 健康检查
  log(colors.blue, '📊 1. 健康检查');
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    log(colors.green, `  ✓ 规则引擎运行正常`);
    log(colors.green, `    - 代码规则: ${health.codeRules} 条`);
    log(colors.green, `    - 对话规则: ${health.dialogueRules} 条`);
    log(colors.green, `    - 运行时间: ${Math.floor(health.uptime)}秒\n`);
  } catch (error) {
    log(colors.red, `  ✗ 健康检查失败: ${error.message}`);
    log(colors.red, '\n请确保规则引擎服务已启动：node scripts/rule-engine-server.js\n');
    process.exit(1);
  }
  
  // 2. 测试代码质量检查
  log(colors.blue, '🔍 2. 代码质量检查测试\n');
  for (const testCase of testCases.codeQuality) {
    totalTests++;
    log(colors.yellow, `  测试: ${testCase.name}`);
    
    const result = await testAPI(`${API_BASE}/check-code`, {
      code: testCase.code,
      filePath: 'test.js',
    }, testCase);
    
    if (!result) {
      continue;
    }
    
    // 验证通过/失败
    const passMatch = result.pass === testCase.expectedPass;
    if (!passMatch) {
      log(colors.red, `    ✗ 预期pass=${testCase.expectedPass}, 实际pass=${result.pass}`);
      continue;
    }
    
    // 验证违规规则
    const actualViolationIds = result.violations.map(v => v.rule);
    const violationMatch = testCase.expectedViolations.every(id => 
      actualViolationIds.includes(id)
    );
    
    if (!violationMatch) {
      log(colors.red, `    ✗ 预期违规: ${testCase.expectedViolations.join(', ')}`);
      log(colors.red, `    ✗ 实际违规: ${actualViolationIds.join(', ')}`);
      continue;
    }
    
    passedTests++;
    log(colors.green, `    ✓ 通过`);
    if (result.violations.length > 0) {
      log(colors.yellow, `      违规: ${result.violations.map(v => `${v.rule} - ${v.message}`).join(', ')}`);
    }
    console.log();
  }
  
  // 3. 测试对话行为检查
  log(colors.blue, '💬 3. 对话行为检查测试\n');
  for (const testCase of testCases.dialogue) {
    totalTests++;
    log(colors.yellow, `  测试: ${testCase.name}`);
    
    const result = await testAPI(`${API_BASE}/check-dialogue`, {
      message: testCase.message,
    }, testCase);
    
    if (!result) {
      continue;
    }
    
    // 验证通过/失败
    const passMatch = result.pass === testCase.expectedPass;
    if (!passMatch) {
      log(colors.red, `    ✗ 预期pass=${testCase.expectedPass}, 实际pass=${result.pass}`);
      log(colors.red, `      违规: ${JSON.stringify(result.violations, null, 2)}`);
      continue;
    }
    
    // 验证违规规则
    const actualViolationIds = result.violations.map(v => v.rule);
    const violationMatch = testCase.expectedViolations.every(id => 
      actualViolationIds.includes(id)
    );
    
    if (!violationMatch && testCase.expectedViolations.length > 0) {
      log(colors.red, `    ✗ 预期违规: ${testCase.expectedViolations.join(', ')}`);
      log(colors.red, `    ✗ 实际违规: ${actualViolationIds.join(', ')}`);
      continue;
    }
    
    passedTests++;
    log(colors.green, `    ✓ 通过`);
    if (result.violations.length > 0) {
      log(colors.yellow, `      违规: ${result.violations.map(v => `${v.rule} - ${v.message}`).join(', ')}`);
    }
    console.log();
  }
  
  // 4. 测试质量门禁
  log(colors.blue, '🚪 4. 质量门禁测试\n');
  totalTests++;
  
  const gateResult = await testAPI(`${API_BASE}/quality-gate`, {
    changes: {
      code: [
        {
          path: 'src/config.js',
          content: 'const password = "hardcoded123";',
        },
      ],
      messages: [
        {
          content: '请确认是否执行？',
        },
      ],
    },
  });
  
  if (gateResult) {
    if (!gateResult.summary.pass) {
      passedTests++;
      log(colors.green, `  ✓ 质量门禁正确阻断违规变更`);
      log(colors.yellow, `    总违规: ${gateResult.summary.totalViolations}`);
      log(colors.yellow, `    错误: ${gateResult.summary.errorCount}`);
      log(colors.yellow, `    警告: ${gateResult.summary.warnCount}\n`);
    } else {
      log(colors.red, `  ✗ 质量门禁应该阻断但没有阻断\n`);
    }
  }
  
  // 总结
  log(colors.blue, '\n╔═══════════════════════════════════════════════════════════╗');
  log(colors.blue, '║              测试结果                                      ║');
  log(colors.blue, '╚═══════════════════════════════════════════════════════════╝\n');
  
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  const passColor = passRate >= 90 ? colors.green : passRate >= 70 ? colors.yellow : colors.red;
  
  log(passColor, `  通过率: ${passedTests}/${totalTests} (${passRate}%)`);
  
  if (passedTests === totalTests) {
    log(colors.green, '\n  ✓ 所有测试通过！规则引擎工作正常。\n');
    process.exit(0);
  } else {
    log(colors.red, `\n  ✗ ${totalTests - passedTests} 个测试失败\n`);
    process.exit(1);
  }
}

// 运行测试
runTests().catch(error => {
  log(colors.red, '\n测试执行失败:', error.message);
  process.exit(1);
});


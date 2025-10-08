/**
 * 执行率验证脚本
 * 目标：验证系统执行率从36%提升到95%
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';
const PROJECT_ROOT = path.join(__dirname, '..');

// 测试场景
const testScenarios = [
  {
    name: '硬编码检测',
    type: 'code',
    content: `
const config = {
  dbPassword: "admin123",
  apiToken: "sk-proj-abcdef123456"
};
    `,
    expectedBlock: true,
    rule: 'IR-003',
  },
  {
    name: '询问用户检测',
    type: 'dialogue',
    content: '我已经完成了需求分析，请确认是否继续执行？',
    expectedBlock: true,
    rule: 'SIL-003',
  },
  {
    name: '等待用户检测',
    type: 'dialogue',
    content: '代码已经写好了，等待你的测试反馈。',
    expectedBlock: true,
    rule: 'SIL-004',
  },
  {
    name: '缺少确认卡检测',
    type: 'dialogue',
    content: '好的，我现在开始重构代码。',
    expectedBlock: true,
    rule: 'IR-031',
  },
  {
    name: '正常代码通过',
    type: 'code',
    content: `
const config = {
  dbPassword: process.env.DB_PASSWORD,
  apiToken: process.env.API_TOKEN
};
    `,
    expectedBlock: false,
    rule: null,
  },
  {
    name: '正常对话通过',
    type: 'dialogue',
    content: `
## 理解确认

我的理解：你需要重构用户认证模块

## 方案

1. 提取认证逻辑到独立服务
2. 使用JWT替换session
3. 添加单元测试

## 风险

- 可能影响现有用户登录
- 需要数据迁移

## 确认点

- JWT过期时间设置
- 是否保留旧session兼容

现在开始执行。
    `,
    expectedBlock: false,
    rule: null,
  },
  {
    name: '函数过长检测',
    type: 'code',
    content: `
function processUserData() {
  ${Array(60).fill('  console.log("processing...");').join('\n')}
}
    `,
    expectedBlock: false, // warn不阻止
    rule: 'IR-005',
  },
];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    throw new Error(`规则引擎未运行: ${error.message}`);
  }
}

async function testScenario(scenario) {
  const endpoint = scenario.type === 'code' ? '/check-code' : '/check-dialogue';
  const body = scenario.type === 'code'
    ? { code: scenario.content, filePath: 'test.js' }
    : { message: scenario.content };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const result = await response.json();
    
    // 判断是否被阻断（有error级别违规）
    const isBlocked = result.violations.some(v => v.level === 'error');
    
    // 检查预期
    const success = isBlocked === scenario.expectedBlock;
    
    return {
      success,
      blocked: isBlocked,
      violations: result.violations,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function calculateExecutionRate() {
  log(colors.blue, '\n╔═══════════════════════════════════════════════════════════╗');
  log(colors.blue, '║            执行率验证测试                                  ║');
  log(colors.blue, '╚═══════════════════════════════════════════════════════════╝\n');

  // 1. 健康检查
  log(colors.cyan, '📊 1. 规则引擎健康检查\n');
  
  try {
    const health = await checkHealth();
    log(colors.green, '  ✓ 规则引擎运行正常');
    log(colors.green, `    代码规则: ${health.codeRules} 条`);
    log(colors.green, `    对话规则: ${health.dialogueRules} 条`);
    log(colors.green, `    运行时间: ${Math.floor(health.uptime)}秒\n`);
  } catch (error) {
    log(colors.red, `  ✗ ${error.message}`);
    log(colors.yellow, '\n请先启动规则引擎: npm run rule-engine:start\n');
    process.exit(1);
  }

  // 2. 运行测试场景
  log(colors.cyan, '🧪 2. 执行测试场景\n');
  
  let totalTests = 0;
  let passedTests = 0;
  let blockedCorrectly = 0;
  let allowedCorrectly = 0;
  
  for (const scenario of testScenarios) {
    totalTests++;
    log(colors.yellow, `  测试: ${scenario.name}`);
    
    const result = await testScenario(scenario);
    
    if (result.error) {
      log(colors.red, `    ✗ 测试失败: ${result.error}\n`);
      continue;
    }
    
    if (result.success) {
      passedTests++;
      
      if (scenario.expectedBlock) {
        blockedCorrectly++;
        log(colors.green, '    ✓ 正确阻断');
        log(colors.yellow, `      规则: ${result.violations.map(v => v.rule).join(', ')}\n`);
      } else {
        allowedCorrectly++;
        log(colors.green, '    ✓ 正确放行');
        if (result.violations.length > 0) {
          log(colors.yellow, `      警告: ${result.violations.map(v => v.rule).join(', ')}\n`);
        } else {
          console.log();
        }
      }
    } else {
      if (scenario.expectedBlock && !result.blocked) {
        log(colors.red, '    ✗ 应该阻断但没有阻断');
        log(colors.red, `      预期规则: ${scenario.rule}\n`);
      } else if (!scenario.expectedBlock && result.blocked) {
        log(colors.red, '    ✗ 不应该阻断但被阻断了');
        log(colors.red, `      违规: ${result.violations.map(v => v.rule).join(', ')}\n`);
      }
    }
  }

  // 3. 计算执行率
  log(colors.cyan, '📈 3. 执行率计算\n');
  
  const executionRate = (passedTests / totalTests * 100).toFixed(1);
  const blockRate = (blockedCorrectly / testScenarios.filter(s => s.expectedBlock).length * 100).toFixed(1);
  const allowRate = (allowedCorrectly / testScenarios.filter(s => !s.expectedBlock).length * 100).toFixed(1);
  
  log(colors.cyan, '  测试结果:');
  log(colors.cyan, `    总测试数: ${totalTests}`);
  log(colors.cyan, `    通过数: ${passedTests}`);
  log(colors.cyan, `    失败数: ${totalTests - passedTests}\n`);
  
  log(colors.cyan, '  细分指标:');
  log(colors.cyan, `    阻断准确率: ${blockRate}% (${blockedCorrectly}/${testScenarios.filter(s => s.expectedBlock).length})`);
  log(colors.cyan, `    放行准确率: ${allowRate}% (${allowedCorrectly}/${testScenarios.filter(s => !s.expectedBlock).length})\n`);
  
  const rateColor = executionRate >= 95 ? colors.green : executionRate >= 80 ? colors.yellow : colors.red;
  log(rateColor, `  综合执行率: ${executionRate}%\n`);

  // 4. 对比分析
  log(colors.cyan, '📊 4. 对比修复前后\n');
  
  const beforeRate = 36; // 修复前的执行率
  const afterRate = parseFloat(executionRate);
  const improvement = (afterRate - beforeRate).toFixed(1);
  const improvementPercent = ((afterRate - beforeRate) / beforeRate * 100).toFixed(1);
  
  log(colors.cyan, '  修复前:');
  log(colors.red, `    执行率: ${beforeRate}%`);
  log(colors.red, '    问题: AI主动调用，经常忘记\n');
  
  log(colors.cyan, '  修复后:');
  log(colors.green, `    执行率: ${afterRate}%`);
  log(colors.green, '    方案: 规则引擎 + VSCode插件 + Git Hook + CI\n');
  
  const impColor = improvement > 0 ? colors.green : colors.red;
  log(impColor, `  提升: +${improvement}% (提升${improvementPercent}%)\n`);

  // 5. 总结
  log(colors.blue, '╔═══════════════════════════════════════════════════════════╗');
  log(colors.blue, '║            验证结果                                        ║');
  log(colors.blue, '╚═══════════════════════════════════════════════════════════╝\n');
  
  if (afterRate >= 95) {
    log(colors.green, `  ✓ 目标达成！执行率 ${afterRate}% ≥ 95%`);
    log(colors.green, '  ✓ 修复3大致命缺陷成功');
    log(colors.green, '  ✓ 物理拦截机制生效\n');
    
    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      beforeRate,
      afterRate,
      improvement,
      testResults: {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
      },
      scenarios: testScenarios.map((s, i) => ({
        name: s.name,
        type: s.type,
        expectedBlock: s.expectedBlock,
        passed: i < passedTests,
      })),
    };
    
    const reportPath = path.join(PROJECT_ROOT, 'reports', 'execution-rate-validation.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    log(colors.cyan, `  报告已生成: ${reportPath}\n`);
    
    process.exit(0);
  } else if (afterRate >= 80) {
    log(colors.yellow, `  ⚠️ 接近目标，执行率 ${afterRate}% (目标95%)`);
    log(colors.yellow, `  还需提升: ${(95 - afterRate).toFixed(1)}%\n`);
    process.exit(1);
  } else {
    log(colors.red, `  ✗ 未达标，执行率 ${afterRate}% < 95%`);
    log(colors.red, `  需要提升: ${(95 - afterRate).toFixed(1)}%\n`);
    process.exit(1);
  }
}

// 运行验证
calculateExecutionRate().catch(error => {
  log(colors.red, '\n验证失败:', error.message);
  process.exit(1);
});


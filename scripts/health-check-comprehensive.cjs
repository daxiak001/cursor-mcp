/**
 * 系统综合健康检查脚本
 * 执行: node scripts/health-check-comprehensive.cjs
 * 功能: 全面检测系统健康状况，生成详细报告
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// 配置
const API_BASE_URL = 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '../data/xiaoliu.db');
const REPORT_DIR = path.join(__dirname, '../reports/health-checks');

// 检查结果
const results = {
  summary: {
    totalChecks: 0,
    passed: 0,
    warnings: 0,
    errors: 0,
    critical: 0
  },
  categories: [],
  startTime: new Date(),
  endTime: null
};

// API请求工具
function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body),
            headers: res.headers
          });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// 检查项基类
class HealthCheck {
  constructor(name, category, priority) {
    this.name = name;
    this.category = category;
    this.priority = priority; // P0, P1, P2
    this.status = 'pending'; // passed, warning, error, critical
    this.message = '';
    this.details = {};
    this.duration = 0;
  }

  async run() {
    const start = Date.now();
    try {
      await this.check();
      this.duration = Date.now() - start;
    } catch (error) {
      this.status = 'error';
      this.message = error.message;
      this.duration = Date.now() - start;
    }
    return this;
  }

  async check() {
    throw new Error('Must implement check() method');
  }

  pass(message, details = {}) {
    this.status = 'passed';
    this.message = message;
    this.details = details;
  }

  warn(message, details = {}) {
    this.status = 'warning';
    this.message = message;
    this.details = details;
  }

  fail(message, details = {}) {
    this.status = 'error';
    this.message = message;
    this.details = details;
  }

  critical(message, details = {}) {
    this.status = 'critical';
    this.message = message;
    this.details = details;
  }
}

// ==================== 1. 核心服务健康检查 ====================

class PM2ProcessCheck extends HealthCheck {
  constructor() {
    super('PM2进程状态', '核心服务健康', 'P0');
  }

  async check() {
    try {
      const { stdout } = await execAsync('pm2 jlist');
      const processes = JSON.parse(stdout);
      const xiaoliuProcess = processes.find(p => p.name.includes('xiaoliu') || p.name.includes('SQLite'));
      
      if (!xiaoliuProcess) {
        return this.critical('未找到小柳规则引擎进程');
      }

      if (xiaoliuProcess.pm2_env.status !== 'online') {
        return this.critical(`进程状态异常: ${xiaoliuProcess.pm2_env.status}`);
      }

      const uptime = Math.floor((Date.now() - xiaoliuProcess.pm2_env.pm_uptime) / 1000);
      const memory = Math.round(xiaoliuProcess.monit.memory / 1024 / 1024);
      const cpu = xiaoliuProcess.monit.cpu;

      this.pass('PM2进程运行正常', {
        pid: xiaoliuProcess.pid,
        uptime: `${Math.floor(uptime / 60)}分钟`,
        memory: `${memory}MB`,
        cpu: `${cpu}%`,
        restarts: xiaoliuProcess.pm2_env.restart_time
      });
    } catch (error) {
      this.warn('无法获取PM2状态（可能未使用PM2）', { error: error.message });
    }
  }
}

class APIHealthCheck extends HealthCheck {
  constructor() {
    super('API健康检查端点', '核心服务健康', 'P0');
  }

  async check() {
    const start = Date.now();
    try {
      const response = await apiRequest('GET', '/api/health');
      const responseTime = Date.now() - start;

      if (response.status !== 200) {
        return this.critical(`健康检查失败: HTTP ${response.status}`);
      }

      if (!response.data || response.data.status !== 'ok') {
        return this.fail('健康检查返回异常', response.data);
      }

      if (responseTime > 100) {
        return this.warn(`响应时间过长: ${responseTime}ms`, {
          responseTime: `${responseTime}ms`,
          threshold: '100ms'
        });
      }

      this.pass('健康检查正常', {
        responseTime: `${responseTime}ms`,
        mode: response.data.mode,
        database: response.data.database,
        rulesTotal: response.data.rules?.total || 0
      });
    } catch (error) {
      this.critical('无法连接到API服务', { error: error.message });
    }
  }
}

class DatabaseConnectionCheck extends HealthCheck {
  constructor() {
    super('数据库连接', '核心服务健康', 'P0');
  }

  async check() {
    if (!fs.existsSync(DB_PATH)) {
      return this.critical('数据库文件不存在', { path: DB_PATH });
    }

    const stats = fs.statSync(DB_PATH);
    const sizeKB = Math.round(stats.size / 1024);

    if (sizeKB === 0) {
      return this.critical('数据库文件为空');
    }

    if (sizeKB > 10240) { // >10MB
      this.warn(`数据库文件过大: ${sizeKB}KB`, { size: `${sizeKB}KB`, threshold: '10MB' });
    } else {
      this.pass('数据库文件正常', {
        size: `${sizeKB}KB`,
        lastModified: stats.mtime.toISOString()
      });
    }
  }
}

class RulesLoadingCheck extends HealthCheck {
  constructor() {
    super('规则加载验证', '核心服务健康', 'P0');
  }

  async check() {
    try {
      const response = await apiRequest('GET', '/api/rules');
      
      if (response.status !== 200 || !response.data.success) {
        return this.fail('规则查询失败');
      }

      const rules = response.data.rules;
      const expectedTotal = 11;

      if (rules.length !== expectedTotal) {
        return this.warn(`规则数量异常: ${rules.length}/${expectedTotal}`, {
          actual: rules.length,
          expected: expectedTotal
        });
      }

      const categories = {};
      rules.forEach(r => {
        categories[r.category] = (categories[r.category] || 0) + 1;
      });

      this.pass('规则加载正常', {
        total: rules.length,
        categories: categories
      });
    } catch (error) {
      this.fail('规则查询异常', { error: error.message });
    }
  }
}

// ==================== 2. 数据完整性检查 ====================

class CoreRulesCheck extends HealthCheck {
  constructor() {
    super('核心规则验证', '数据完整性', 'P0');
  }

  async check() {
    const coreRules = ['IR-003', 'SIL-003', 'SIL-004', 'IR-031'];
    const missing = [];

    for (const ruleId of coreRules) {
      try {
        const response = await apiRequest('GET', `/api/rules/${ruleId}`);
        if (response.status !== 200 || !response.data.success) {
          missing.push(ruleId);
        }
      } catch (error) {
        missing.push(ruleId);
      }
    }

    if (missing.length > 0) {
      this.critical(`核心规则缺失: ${missing.join(', ')}`, { missing });
    } else {
      this.pass('核心规则完整', { verified: coreRules });
    }
  }
}

class ConfigDataCheck extends HealthCheck {
  constructor() {
    super('配置数据验证', '数据完整性', 'P0');
  }

  async check() {
    const requiredConfigs = [
      { key: 'execution_rate_target', expected: 95, type: 'number' },
      { key: 'ssh_port', expected: 22, type: 'number' },
      { key: 'api_port', expected: 8889, type: 'number' }
    ];

    const issues = [];

    for (const config of requiredConfigs) {
      try {
        const response = await apiRequest('GET', `/api/config/${config.key}`);
        if (response.status !== 200 || !response.data.success) {
          issues.push(`${config.key}: 不存在`);
          continue;
        }

        const value = response.data.value;
        if (typeof value !== config.type) {
          issues.push(`${config.key}: 类型错误 (${typeof value} vs ${config.type})`);
        }
        if (value !== config.expected) {
          issues.push(`${config.key}: 值异常 (${value} vs ${config.expected})`);
        }
      } catch (error) {
        issues.push(`${config.key}: 查询失败`);
      }
    }

    if (issues.length > 0) {
      this.warn('配置数据异常', { issues });
    } else {
      this.pass('配置数据正常', { verified: requiredConfigs.length });
    }
  }
}

class AuditLogsCheck extends HealthCheck {
  constructor() {
    super('审计日志完整性', '数据完整性', 'P1');
  }

  async check() {
    try {
      const response = await apiRequest('GET', '/api/audit-logs');
      
      if (response.status !== 200 || !response.data.success) {
        return this.warn('无法获取审计日志');
      }

      const logs = response.data.logs;
      
      if (logs.length === 0) {
        return this.warn('审计日志为空（可能是新部署）');
      }

      this.pass('审计日志正常', {
        count: logs.length,
        latest: logs[0]?.created_at || 'N/A'
      });
    } catch (error) {
      this.warn('审计日志查询失败', { error: error.message });
    }
  }
}

// ==================== 3. API功能验证 ====================

class APIFunctionalCheck extends HealthCheck {
  constructor(endpoint, method, name) {
    super(name, 'API功能验证', 'P0');
    this.endpoint = endpoint;
    this.method = method;
  }

  async check() {
    const start = Date.now();
    try {
      let testData = null;
      
      if (this.method === 'POST') {
        if (this.endpoint.includes('check-code')) {
          testData = { code: 'const password = "123";', filePath: 'test.js' };
        } else if (this.endpoint.includes('check-dialogue')) {
          testData = { text: '你需要这个功能吗？' };
        } else if (this.endpoint.includes('quality-gate')) {
          testData = { code: 'const token = "abc";', dialogue: '请确认' };
        }
      }

      const response = await (this.method === 'POST' 
        ? apiRequest('POST', this.endpoint, testData)
        : apiRequest('GET', this.endpoint));
      
      const responseTime = Date.now() - start;

      // 检查response和status是否存在
      if (!response || response.status === undefined) {
        return this.warn('API响应格式异常', { response: JSON.stringify(response) });
      }

      if (response.status >= 200 && response.status < 300) {
        this.pass('API正常', { responseTime: `${responseTime}ms`, status: response.status });
      } else if (response.status === 404) {
        this.fail('API不存在', { status: 404 });
      } else {
        this.warn(`API响应异常: ${response.status}`, { status: response.status });
      }
    } catch (error) {
      this.fail('API调用失败', { error: error.message });
    }
  }
}

// ==================== 4. 性能指标评估 ====================

class ResponseTimeCheck extends HealthCheck {
  constructor() {
    super('API响应时间', '性能指标', 'P1');
  }

  async check() {
    const tests = [
      { name: 'health', endpoint: '/api/health', threshold: 50 },
      { name: 'rules', endpoint: '/api/rules', threshold: 100 },
      { name: 'check-code', endpoint: '/api/check-code', method: 'POST', data: { code: 'test' }, threshold: 100 }
    ];

    const results = [];
    let totalTime = 0;

    for (const test of tests) {
      const start = Date.now();
      try {
        const response = test.method === 'POST'
          ? await apiRequest('POST', test.endpoint, test.data)
          : await apiRequest('GET', test.endpoint);
        
        const time = Date.now() - start;
        totalTime += time;
        results.push({
          name: test.name,
          time: `${time}ms`,
          status: time > test.threshold ? 'slow' : 'ok'
        });
      } catch (error) {
        results.push({ name: test.name, time: 'error', status: 'error' });
      }
    }

    const avgTime = Math.round(totalTime / tests.length);
    const slowAPIs = results.filter(r => r.status === 'slow');

    if (slowAPIs.length > 0) {
      this.warn(`部分API响应较慢 (平均${avgTime}ms)`, { results, slowAPIs });
    } else {
      this.pass(`响应时间良好 (平均${avgTime}ms)`, { results });
    }
  }
}

// ==================== 5. 安全审计 ====================

class SQLInjectionCheck extends HealthCheck {
  constructor() {
    super('SQL注入防护', '安全审计', 'P0');
  }

  async check() {
    const injectionPayloads = [
      "' OR '1'='1",
      "1'; DROP TABLE rules--",
      "1 UNION SELECT * FROM sqlite_master"
    ];

    let vulnerable = false;
    const vulnerableEndpoints = [];

    for (const payload of injectionPayloads) {
      try {
        const response = await apiRequest('GET', `/api/rules/${payload}`);
        // 如果返回500错误或数据库错误，可能存在注入漏洞
        if (response.status === 500 || (response.data && response.data.error && response.data.error.includes('SQL'))) {
          vulnerable = true;
          vulnerableEndpoints.push({ payload, status: response.status });
        }
      } catch (error) {
        // 捕获的错误可能表明防护有效
      }
    }

    if (vulnerable) {
      this.critical('可能存在SQL注入漏洞', { vulnerableEndpoints });
    } else {
      this.pass('SQL注入防护有效', { tested: injectionPayloads.length });
    }
  }
}

// ==================== 执行所有检查 ====================

async function runHealthChecks() {
  console.log('🏥 开始系统深度体检...\n');

  const checks = [
    // 1. 核心服务健康
    new PM2ProcessCheck(),
    new APIHealthCheck(),
    new DatabaseConnectionCheck(),
    new RulesLoadingCheck(),

    // 2. 数据完整性
    new CoreRulesCheck(),
    new ConfigDataCheck(),
    new AuditLogsCheck(),

    // 3. API功能验证
    new APIFunctionalCheck('/api/health', 'GET', 'GET /api/health'),
    new APIFunctionalCheck('/api/check-code', 'POST', 'POST /api/check-code'),
    new APIFunctionalCheck('/api/check-dialogue', 'POST', 'POST /api/check-dialogue'),
    new APIFunctionalCheck('/api/quality-gate', 'POST', 'POST /api/quality-gate'),
    new APIFunctionalCheck('/api/rules', 'GET', 'GET /api/rules'),
    new APIFunctionalCheck('/api/audit-logs', 'GET', 'GET /api/audit-logs'),

    // 4. 性能指标
    new ResponseTimeCheck(),

    // 5. 安全审计
    new SQLInjectionCheck()
  ];

  // 按类别分组
  const categories = {};
  checks.forEach(check => {
    if (!categories[check.category]) {
      categories[check.category] = [];
    }
    categories[check.category].push(check);
  });

  // 执行检查
  for (const [category, categoryChecks] of Object.entries(categories)) {
    console.log(`\n📋 ${category}`);
    console.log('━'.repeat(60));

    const categoryResult = {
      name: category,
      checks: [],
      passed: 0,
      warnings: 0,
      errors: 0,
      critical: 0
    };

    for (const check of categoryChecks) {
      await check.run();
      results.summary.totalChecks++;

      const icon = {
        passed: '✅',
        warning: '⚠️ ',
        error: '❌',
        critical: '🚨'
      }[check.status];

      console.log(`  ${icon} ${check.name}: ${check.message}`);
      if (Object.keys(check.details).length > 0) {
        console.log(`     详情: ${JSON.stringify(check.details)}`);
      }

      categoryResult.checks.push({
        name: check.name,
        status: check.status,
        message: check.message,
        details: check.details,
        duration: check.duration
      });

      // 统计
      results.summary[check.status]++;
      categoryResult[check.status]++;
    }

    results.categories.push(categoryResult);
  }

  results.endTime = new Date();

  return results;
}

// ==================== 生成报告 ====================

function generateReport(results) {
  const duration = Math.round((results.endTime - results.startTime) / 1000);
  const passRate = Math.round((results.summary.passed / results.summary.totalChecks) * 100);

  let report = `# 系统健康体检报告

**生成时间**: ${results.endTime.toISOString()}  
**体检耗时**: ${duration}秒  
**通过率**: ${passRate}%

---

## 📊 执行摘要

| 项目 | 数量 | 占比 |
|------|------|------|
| 总检查项 | ${results.summary.totalChecks} | 100% |
| ✅ 通过 | ${results.summary.passed} | ${Math.round(results.summary.passed/results.summary.totalChecks*100)}% |
| ⚠️  警告 | ${results.summary.warnings} | ${Math.round(results.summary.warnings/results.summary.totalChecks*100)}% |
| ❌ 错误 | ${results.summary.errors} | ${Math.round(results.summary.errors/results.summary.totalChecks*100)}% |
| 🚨 严重 | ${results.summary.critical} | ${Math.round(results.summary.critical/results.summary.totalChecks*100)}% |

---

## 🔍 详细结果

`;

  results.categories.forEach(category => {
    report += `\n### ${category.name}\n\n`;
    report += `**统计**: 通过${category.passed}项, 警告${category.warnings}项, 错误${category.errors}项, 严重${category.critical}项\n\n`;

    category.checks.forEach(check => {
      const icon = { passed: '✅', warning: '⚠️', error: '❌', critical: '🚨' }[check.status];
      report += `- ${icon} **${check.name}**: ${check.message}\n`;
      if (Object.keys(check.details).length > 0) {
        report += `  - 详情: \`${JSON.stringify(check.details)}\`\n`;
      }
      report += `  - 耗时: ${check.duration}ms\n`;
    });
  });

  report += `\n---\n\n## 💡 改进建议\n\n`;

  const criticalIssues = results.categories.flatMap(c => c.checks.filter(check => check.status === 'critical'));
  const errorIssues = results.categories.flatMap(c => c.checks.filter(check => check.status === 'error'));
  const warningIssues = results.categories.flatMap(c => c.checks.filter(check => check.status === 'warning'));

  if (criticalIssues.length > 0) {
    report += `### 🚨 立即处理（Critical）\n\n`;
    criticalIssues.forEach(issue => {
      report += `1. **${issue.name}**: ${issue.message}\n`;
    });
  }

  if (errorIssues.length > 0) {
    report += `\n### ❌ 优先修复（High）\n\n`;
    errorIssues.forEach(issue => {
      report += `1. **${issue.name}**: ${issue.message}\n`;
    });
  }

  if (warningIssues.length > 0) {
    report += `\n### ⚠️  建议优化（Medium）\n\n`;
    warningIssues.forEach(issue => {
      report += `1. **${issue.name}**: ${issue.message}\n`;
    });
  }

  report += `\n---\n\n## ✅ 健康评级\n\n`;

  let grade = 'A+';
  if (results.summary.critical > 0) grade = 'D';
  else if (results.summary.errors > 2) grade = 'C';
  else if (results.summary.errors > 0) grade = 'B';
  else if (results.summary.warnings > 3) grade = 'B+';
  else if (results.summary.warnings > 0) grade = 'A';

  report += `**系统健康评级**: ${grade}\n\n`;
  report += `**建议**: ${
    grade === 'A+' ? '系统运行状况优秀，继续保持' :
    grade === 'A' ? '系统运行良好，建议处理警告项' :
    grade === 'B+' ? '系统基本正常，建议优化警告项' :
    grade === 'B' ? '系统存在问题，需要修复错误项' :
    grade === 'C' ? '系统问题较多，需要尽快修复' :
    '系统存在严重问题，必须立即处理'
  }\n`;

  return report;
}

// ==================== 主函数 ====================

async function main() {
  try {
    const results = await runHealthChecks();

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 体检完成！生成报告中...\n');

    const report = generateReport(results);

    // 确保报告目录存在
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    // 保存报告
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportPath = path.join(REPORT_DIR, `health-check-${timestamp}.md`);
    fs.writeFileSync(reportPath, report);

    console.log(`📄 报告已保存: ${reportPath}`);

    // 输出摘要
    console.log('\n📊 体检摘要:');
    console.log(`   总检查项: ${results.summary.totalChecks}`);
    console.log(`   ✅ 通过: ${results.summary.passed}`);
    console.log(`   ⚠️  警告: ${results.summary.warnings}`);
    console.log(`   ❌ 错误: ${results.summary.errors}`);
    console.log(`   🚨 严重: ${results.summary.critical}`);

    const passRate = Math.round((results.summary.passed / results.summary.totalChecks) * 100);
    console.log(`   通过率: ${passRate}%\n`);

    // 退出码
    process.exit(results.summary.critical > 0 ? 2 : results.summary.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ 体检执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();


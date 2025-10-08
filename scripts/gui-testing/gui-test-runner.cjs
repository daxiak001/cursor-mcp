/**
 * GUI自动化测试运行器
 * 实现IR-020（三重验证）和IR-021（5轮测试）
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class GUITestRunner {
  constructor() {
    this.testResults = [];
    this.screenshotDir = path.join(__dirname, '../../tests/gui-tests/screenshots');
    this.ensureScreenshotDir();
  }

  ensureScreenshotDir() {
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  /**
   * 三重验证测试
   * @param {string} appType - 'web' 或 'desktop'
   * @param {string} appPath - 应用路径或URL
   * @returns {Promise<Object>} 测试结果
   */
  async runTripleVerification(appType, appPath) {
    const round = this.testResults.length + 1;
    const result = {
      round,
      timestamp: new Date().toISOString(),
      appType,
      appPath,
      verification: {
        screenshot: false,
        logs: false,
        execution: false
      },
      details: {},
      errors: []
    };

    try {
      if (appType === 'web') {
        await this.runWebTest(appPath, result);
      } else if (appType === 'desktop') {
        await this.runDesktopTest(appPath, result);
      } else {
        throw new Error(`不支持的应用类型: ${appType}`);
      }

      this.testResults.push(result);
      return result;

    } catch (error) {
      result.errors.push(error.message);
      this.testResults.push(result);
      throw error;
    }
  }

  /**
   * Web应用测试
   */
  async runWebTest(url, result) {
    const browser = await puppeteer.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();

      // 1. 日志监控
      const logs = [];
      page.on('console', msg => {
        logs.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString()
        });
      });

      page.on('pageerror', error => {
        logs.push({
          type: 'error',
          text: error.message,
          timestamp: new Date().toISOString()
        });
      });

      // 2. 实际执行 - 访问页面
      console.log(`[Round ${result.round}] 正在访问: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      result.verification.execution = true;
      console.log(`[Round ${result.round}] ✅ 页面加载成功`);

      // 等待页面完全渲染
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. 截图验证
      const screenshotPath = path.join(
        this.screenshotDir,
        `round-${result.round}-${Date.now()}.png`
      );
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });
      result.verification.screenshot = true;
      result.details.screenshotPath = screenshotPath;
      console.log(`[Round ${result.round}] ✅ 截图保存: ${path.basename(screenshotPath)}`);

      // 4. 日志验证
      result.verification.logs = logs.length > 0;
      result.details.logs = logs;
      result.details.logCount = logs.length;
      console.log(`[Round ${result.round}] ✅ 日志捕获: ${logs.length}条`);

      // 5. 获取页面标题和URL作为验证
      result.details.pageTitle = await page.title();
      result.details.pageUrl = page.url();

    } finally {
      await browser.close();
    }
  }

  /**
   * 桌面应用测试（使用Playwright）
   */
  async runDesktopTest(appPath, result) {
    // 这里可以集成Playwright for Electron或其他桌面自动化工具
    // 暂时作为占位符
    throw new Error('桌面应用测试功能即将实现，请使用web类型进行测试');
  }

  /**
   * 5轮完整测试
   * @param {string} appType - 应用类型
   * @param {string} appPath - 应用路径
   * @param {number} rounds - 测试轮数，默认5轮
   * @returns {Promise<Array>} 所有测试结果
   */
  async run5RoundsTest(appType, appPath, rounds = 5) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 开始 ${rounds} 轮完整GUI测试`);
    console.log(`应用类型: ${appType}`);
    console.log(`应用路径: ${appPath}`);
    console.log(`${'='.repeat(60)}\n`);

    const startTime = Date.now();
    
    for (let i = 1; i <= rounds; i++) {
      console.log(`\n${'━'.repeat(60)}`);
      console.log(`🧪 第 ${i} 轮测试`);
      console.log(`${'━'.repeat(60)}\n`);

      try {
        const result = await this.runTripleVerification(appType, appPath);
        
        // 显示验证结果
        console.log(`\n【三重验证结果】`);
        console.log(`  截图验证: ${result.verification.screenshot ? '✅ 通过' : '❌ 失败'}`);
        console.log(`  日志验证: ${result.verification.logs ? '✅ 通过' : '❌ 失败'}`);
        console.log(`  实际执行: ${result.verification.execution ? '✅ 通过' : '❌ 失败'}`);
        
        if (result.details.pageTitle) {
          console.log(`  页面标题: ${result.details.pageTitle}`);
        }

        // 检查是否全部通过
        const allPassed = result.verification.screenshot && 
                         result.verification.logs && 
                         result.verification.execution;

        if (!allPassed) {
          console.log(`\n⚠️  第 ${i} 轮测试未完全通过`);
        }

        // 轮次间隔
        if (i < rounds) {
          console.log(`\n⏳ 等待2秒后开始下一轮...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`\n❌ 第 ${i} 轮测试失败: ${error.message}`);
        
        // 记录失败但继续测试
        if (i < rounds) {
          console.log(`⏭️  继续下一轮测试...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // 生成报告
    const report = this.generateReport(duration);
    console.log('\n' + report);
    
    return this.testResults;
  }

  /**
   * 生成测试报告
   */
  generateReport(duration = 'N/A') {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => 
      r.verification.screenshot && 
      r.verification.logs && 
      r.verification.execution
    ).length;

    const failed = total - passed;
    const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    // 统计各项验证通过率
    const screenshotPassed = this.testResults.filter(r => r.verification.screenshot).length;
    const logsPassed = this.testResults.filter(r => r.verification.logs).length;
    const executionPassed = this.testResults.filter(r => r.verification.execution).length;

    let report = `
${'='.repeat(70)}
                    📊 GUI自动化测试报告
${'='.repeat(70)}

【测试概况】
  总测试轮数: ${total}
  通过轮数: ${passed}
  失败轮数: ${failed}
  成功率: ${successRate}%
  测试时长: ${duration}秒

【三重验证统计】
  ✅ 截图验证通过: ${screenshotPassed}/${total} (${((screenshotPassed/total)*100).toFixed(1)}%)
  ✅ 日志验证通过: ${logsPassed}/${total} (${((logsPassed/total)*100).toFixed(1)}%)
  ✅ 实际执行通过: ${executionPassed}/${total} (${((executionPassed/total)*100).toFixed(1)}%)

【详细结果】`;

    this.testResults.forEach((result, index) => {
      const status = (result.verification.screenshot && 
                     result.verification.logs && 
                     result.verification.execution) ? '✅' : '❌';
      
      report += `
  ${status} 第${index + 1}轮:
     - 截图: ${result.verification.screenshot ? '✅' : '❌'} ${result.details.screenshotPath ? path.basename(result.details.screenshotPath) : ''}
     - 日志: ${result.verification.logs ? '✅' : '❌'} (${result.details.logCount || 0}条)
     - 执行: ${result.verification.execution ? '✅' : '❌'}`;
      
      if (result.errors.length > 0) {
        report += `\n     - 错误: ${result.errors.join(', ')}`;
      }
    });

    report += `

【截图文件位置】
  ${this.screenshotDir}

【测试结论】
  ${successRate === '100.0' ? '✅ 所有测试全部通过！系统运行正常。' : 
    `⚠️  成功率${successRate}%，建议检查失败的测试用例。`}

${'='.repeat(70)}
`;

    return report;
  }

  /**
   * 保存测试报告到文件
   */
  async saveReport(filename = null) {
    const reportDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFile = filename || `gui-test-report-${Date.now()}.md`;
    const reportPath = path.join(reportDir, reportFile);
    
    const report = this.generateReport();
    fs.writeFileSync(reportPath, report, 'utf8');
    
    console.log(`\n📄 测试报告已保存: ${reportPath}`);
    return reportPath;
  }
}

// 导出
module.exports = GUITestRunner;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
使用方法:
  node gui-test-runner.cjs <类型> <路径> [轮数]

参数:
  <类型>  应用类型: web 或 desktop
  <路径>  应用路径或URL
  [轮数]  测试轮数，默认5轮

示例:
  node gui-test-runner.cjs web http://localhost:3000
  node gui-test-runner.cjs web http://localhost:3000 3
    `);
    process.exit(1);
  }

  const [appType, appPath, rounds = 5] = args;
  
  const runner = new GUITestRunner();
  
  runner.run5RoundsTest(appType, appPath, parseInt(rounds))
    .then(async (results) => {
      await runner.saveReport();
      
      const allPassed = results.every(r => 
        r.verification.screenshot && 
        r.verification.logs && 
        r.verification.execution
      );
      
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('\n❌ 测试执行失败:', error.message);
      process.exit(1);
    });
}


/**
 * 系统全面诊断测试脚本
 * 团队协作：四角色共同执行
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ComprehensiveTest {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.phase = 0;
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.skippedTests = 0;
  }

  /**
   * 执行命令并捕获结果
   */
  executeCommand(command, timeout = 10000) {
    try {
      const output = execSync(command, { 
        encoding: 'utf8',
        timeout,
        cwd: path.join(__dirname, '../..')
      });
      return { success: true, output };
    } catch (error) {
      return { success: false, error: error.message, output: error.stdout };
    }
  }

  /**
   * 运行单个测试
   */
  async runTest(test) {
    this.totalTests++;
    console.log(`\n  [${test.id}] ${test.name}...`);

    const result = {
      id: test.id,
      name: test.name,
      status: 'pending',
      startTime: Date.now(),
      output: null,
      error: null,
      critical: test.critical || false
    };

    try {
      if (test.command) {
        const cmdResult = this.executeCommand(test.command);
        
        if (cmdResult.success) {
          // 检查预期输出
          if (test.expected) {
            if (cmdResult.output.includes(test.expected)) {
              result.status = 'passed';
              result.output = cmdResult.output.substring(0, 200);
              this.passedTests++;
              console.log(`    ✅ 通过`);
            } else {
              result.status = 'failed';
              result.error = `输出不符合预期。预期包含: ${test.expected}`;
              result.output = cmdResult.output.substring(0, 200);
              this.failedTests++;
              console.log(`    ❌ 失败: ${result.error}`);
            }
          } else {
            result.status = 'passed';
            result.output = cmdResult.output.substring(0, 200);
            this.passedTests++;
            console.log(`    ✅ 通过`);
          }
        } else {
          result.status = 'failed';
          result.error = cmdResult.error;
          this.failedTests++;
          console.log(`    ❌ 失败: ${cmdResult.error}`);
        }
      } else if (test.file) {
        // 检查文件是否存在
        const filePath = path.join(__dirname, '../..', test.file);
        if (fs.existsSync(filePath)) {
          result.status = 'passed';
          result.output = `文件存在: ${test.file}`;
          this.passedTests++;
          console.log(`    ✅ 通过`);
        } else {
          result.status = 'failed';
          result.error = `文件不存在: ${test.file}`;
          this.failedTests++;
          console.log(`    ❌ 失败: ${result.error}`);
        }
      } else {
        result.status = 'skipped';
        result.error = '无测试命令';
        this.skippedTests++;
        console.log(`    ⏭️  跳过`);
      }
    } catch (error) {
      result.status = 'error';
      result.error = error.message;
      this.failedTests++;
      console.log(`    ❌ 错误: ${error.message}`);
    }

    result.duration = Date.now() - result.startTime;
    this.results.push(result);
    
    return result;
  }

  /**
   * Phase 1: 环境与基础检查
   */
  async phase1_environment() {
    this.phase = 1;
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Phase 1: 环境与基础检查 [技术开发·小柳]                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const tests = [
      {
        id: 'T001',
        name: '版本信息验证',
        command: 'node scripts/tools/version.cjs short',
        expected: 'v6.1',
        critical: true
      },
      {
        id: 'T002',
        name: '自我介绍功能',
        command: 'node scripts/tools/self-intro.cjs short',
        expected: '小柳智能开发助手',
        critical: true
      },
      {
        id: 'T003',
        name: '团队配置验证',
        command: 'node scripts/tools/self-intro.cjs team',
        expected: '小户',
        critical: true
      },
      {
        id: 'T004',
        name: '版本文件验证',
        command: 'node scripts/tools/bump-version.cjs validate',
        expected: '验证通过',
        critical: true
      }
    ];

    for (const test of tests) {
      await this.runTest(test);
    }
  }

  /**
   * Phase 2: 规则引擎诊断
   */
  async phase2_ruleEngine() {
    this.phase = 2;
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Phase 2: 规则引擎诊断 [监督管理·小观]                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const tests = [
      {
        id: 'T101',
        name: '规则文件存在性检查',
        file: 'policy/core-l1.yaml',
        critical: true
      },
      {
        id: 'T102',
        name: '对话规则文件',
        file: 'policy/dialogue-l1.yaml',
        critical: true
      },
      {
        id: 'T103',
        name: 'GUI测试规则文件',
        file: 'policy/gui-testing-best-practices.yaml',
        critical: true
      },
      {
        id: 'T104',
        name: '数据格式规则文件（IR-040）',
        file: 'policy/data-format-l1.yaml',
        critical: true
      },
      {
        id: 'T105',
        name: '版本管理规则文件（SYS-012）',
        file: 'policy/version-management-l1.yaml',
        critical: true
      }
    ];

    for (const test of tests) {
      await this.runTest(test);
    }
  }

  /**
   * Phase 3: 工具套件测试
   */
  async phase3_tools() {
    this.phase = 3;
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Phase 3: 工具套件测试 [技术开发·小柳]                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const tests = [
      {
        id: 'T201',
        name: '版本查询工具',
        command: 'node scripts/tools/version.cjs version',
        expected: 'v6.1',
        critical: true
      },
      {
        id: 'T202',
        name: '自我介绍工具',
        command: 'node scripts/tools/self-intro.cjs',
        expected: '核心能力',
        critical: true
      },
      {
        id: 'T203',
        name: '升级检查清单工具',
        command: 'node scripts/tools/upgrade-checklist.cjs show',
        expected: '检查清单',
        critical: false
      },
      {
        id: 'T204',
        name: 'MD转JSON工具',
        file: 'scripts/tools/md-to-json-converter.cjs',
        critical: false
      }
    ];

    for (const test of tests) {
      await this.runTest(test);
    }
  }

  /**
   * Phase 4: 核心文件检查
   */
  async phase4_coreFiles() {
    this.phase = 4;
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Phase 4: 核心文件检查 [产品经理·小品]                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const tests = [
      {
        id: 'T301',
        name: '规则引擎服务',
        file: 'scripts/core/rule-engine-server.cjs',
        critical: true
      },
      {
        id: 'T302',
        name: '团队配置文件',
        file: 'team-config.json',
        critical: true
      },
      {
        id: 'T303',
        name: 'GUI测试指南',
        file: 'docs/gui-testing-guide.json',
        critical: false
      },
      {
        id: 'T304',
        name: '系统升级指南',
        file: 'docs/upgrade-guide.md',
        critical: false
      }
    ];

    for (const test of tests) {
      await this.runTest(test);
    }
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    const duration = Date.now() - this.startTime;
    const passRate = ((this.passedTests / this.totalTests) * 100).toFixed(2);
    
    const criticalTests = this.results.filter(r => r.critical);
    const criticalFailed = criticalTests.filter(r => r.status === 'failed');
    
    const report = {
      timestamp: new Date().toISOString(),
      version: 'v6.1.1',
      test_summary: {
        total_tests: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        skipped: this.skippedTests,
        pass_rate: `${passRate}%`,
        duration_ms: duration,
        duration_readable: `${Math.floor(duration / 1000)}秒`
      },
      critical_tests: {
        total: criticalTests.length,
        failed: criticalFailed.length,
        pass_rate: `${((criticalTests.length - criticalFailed.length) / criticalTests.length * 100).toFixed(2)}%`
      },
      test_results: this.results,
      status: this.failedTests === 0 ? '✅ 通过' : '❌ 失败'
    };

    return report;
  }

  /**
   * 显示测试摘要
   */
  displaySummary() {
    console.log('\n' + '='.repeat(70));
    console.log('                        测试摘要');
    console.log('='.repeat(70));
    
    const duration = Date.now() - this.startTime;
    const passRate = ((this.passedTests / this.totalTests) * 100).toFixed(2);
    
    console.log(`\n📊 测试统计:`);
    console.log(`  总测试数: ${this.totalTests}`);
    console.log(`  通过: ${this.passedTests} ✅`);
    console.log(`  失败: ${this.failedTests} ❌`);
    console.log(`  跳过: ${this.skippedTests} ⏭️`);
    console.log(`  通过率: ${passRate}%`);
    console.log(`  耗时: ${Math.floor(duration / 1000)}秒`);
    
    const criticalTests = this.results.filter(r => r.critical);
    const criticalFailed = criticalTests.filter(r => r.status === 'failed');
    
    console.log(`\n🔴 关键测试:`);
    console.log(`  关键测试数: ${criticalTests.length}`);
    console.log(`  失败: ${criticalFailed.length}`);
    
    if (criticalFailed.length > 0) {
      console.log(`\n❌ 失败的关键测试:`);
      criticalFailed.forEach(test => {
        console.log(`  • ${test.id}: ${test.name}`);
        console.log(`    错误: ${test.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
    
    if (this.failedTests === 0) {
      console.log('✅ 所有测试通过！系统状态良好。');
    } else {
      console.log('❌ 部分测试失败，请查看详细报告。');
    }
    
    console.log('='.repeat(70) + '\n');
  }

  /**
   * 保存报告
   */
  saveReport() {
    const report = this.generateReport();
    const reportPath = path.join(__dirname, '../..', '系统诊断报告.json');
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📄 详细报告已保存: 系统诊断报告.json`);
  }

  /**
   * 运行所有测试
   */
  async runAll() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                ║');
    console.log('║           🤖 小柳智能开发助手 - 系统全面诊断测试              ║');
    console.log('║                    团队模式：四角色协作                        ║');
    console.log('║                                                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    await this.phase1_environment();
    await this.phase2_ruleEngine();
    await this.phase3_tools();
    await this.phase4_coreFiles();
    
    this.displaySummary();
    this.saveReport();
  }
}

// 执行测试
if (require.main === module) {
  const test = new ComprehensiveTest();
  test.runAll().catch(error => {
    console.error('❌ 测试执行错误:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveTest;


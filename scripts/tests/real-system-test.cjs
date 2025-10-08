/**
 * 真实系统测试 - 符合IR-041铁律
 * 所有测试必须真实执行，禁止模拟
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const http = require('http');

class RealSystemTest {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.evidenceDir = path.join(__dirname, '../..', 'test-evidence');
    
    // 创建证据目录
    if (!fs.existsSync(this.evidenceDir)) {
      fs.mkdirSync(this.evidenceDir, { recursive: true });
    }
  }

  /**
   * 记录测试证据
   */
  saveEvidence(testId, evidence) {
    const evidencePath = path.join(this.evidenceDir, `${testId}_${Date.now()}.json`);
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
    return evidencePath;
  }

  /**
   * 真实执行命令（IR-041要求）
   */
  realExecute(command, testId) {
    const startTime = Date.now();
    
    try {
      console.log(`    执行: ${command}`);
      
      const output = execSync(command, {
        encoding: 'utf8',
        cwd: path.join(__dirname, '../..'),
        timeout: 30000
      });
      
      const duration = Date.now() - startTime;
      
      // 保存执行证据
      const evidence = {
        testId,
        command,
        timestamp: new Date().toISOString(),
        duration,
        output: output.substring(0, 1000),
        success: true
      };
      
      const evidencePath = this.saveEvidence(testId, evidence);
      console.log(`    ✅ 执行成功 (${duration}ms)`);
      console.log(`    证据: ${path.basename(evidencePath)}`);
      
      return { success: true, output, duration, evidencePath };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 保存失败证据
      const evidence = {
        testId,
        command,
        timestamp: new Date().toISOString(),
        duration,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        success: false
      };
      
      const evidencePath = this.saveEvidence(testId, evidence);
      console.log(`    ❌ 执行失败: ${error.message}`);
      console.log(`    证据: ${path.basename(evidencePath)}`);
      
      return { success: false, error: error.message, duration, evidencePath };
    }
  }

  /**
   * 真实API调用测试（IR-041要求）
   */
  async realAPITest(endpoint, testId) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      console.log(`    调用: GET ${endpoint}`);
      
      const req = http.get(`http://localhost:3000${endpoint}`, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          const duration = Date.now() - startTime;
          
          // 保存API响应证据
          const evidence = {
            testId,
            endpoint,
            method: 'GET',
            timestamp: new Date().toISOString(),
            duration,
            statusCode: res.statusCode,
            headers: res.headers,
            body: data.substring(0, 1000),
            success: res.statusCode === 200
          };
          
          const evidencePath = this.saveEvidence(testId, evidence);
          
          if (res.statusCode === 200) {
            console.log(`    ✅ API响应成功 (${duration}ms)`);
            console.log(`    状态: ${res.statusCode}`);
            console.log(`    证据: ${path.basename(evidencePath)}`);
            
            resolve({ 
              success: true, 
              statusCode: res.statusCode, 
              data, 
              duration,
              evidencePath 
            });
          } else {
            console.log(`    ❌ API响应异常: ${res.statusCode}`);
            console.log(`    证据: ${path.basename(evidencePath)}`);
            
            resolve({ 
              success: false, 
              statusCode: res.statusCode, 
              data, 
              duration,
              evidencePath 
            });
          }
        });
      });
      
      req.on('error', (error) => {
        const duration = Date.now() - startTime;
        
        const evidence = {
          testId,
          endpoint,
          timestamp: new Date().toISOString(),
          duration,
          error: error.message,
          success: false
        };
        
        const evidencePath = this.saveEvidence(testId, evidence);
        console.log(`    ❌ API调用失败: ${error.message}`);
        console.log(`    证据: ${path.basename(evidencePath)}`);
        
        resolve({ 
          success: false, 
          error: error.message, 
          duration,
          evidencePath 
        });
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ success: false, error: 'Timeout', duration: 10000 });
      });
    });
  }

  /**
   * 真实文件检查（IR-041要求）
   */
  realFileCheck(filePath, testId) {
    const startTime = Date.now();
    const fullPath = path.join(__dirname, '../..', filePath);
    
    console.log(`    检查: ${filePath}`);
    
    try {
      const exists = fs.existsSync(fullPath);
      const stats = exists ? fs.statSync(fullPath) : null;
      const duration = Date.now() - startTime;
      
      // 保存文件检查证据
      const evidence = {
        testId,
        filePath,
        timestamp: new Date().toISOString(),
        duration,
        exists,
        size: stats ? stats.size : 0,
        modified: stats ? stats.mtime.toISOString() : null,
        success: exists
      };
      
      const evidencePath = this.saveEvidence(testId, evidence);
      
      if (exists) {
        console.log(`    ✅ 文件存在 (${stats.size} bytes)`);
        console.log(`    修改时间: ${stats.mtime.toLocaleString('zh-CN')}`);
        console.log(`    证据: ${path.basename(evidencePath)}`);
      } else {
        console.log(`    ❌ 文件不存在`);
        console.log(`    证据: ${path.basename(evidencePath)}`);
      }
      
      return { 
        success: exists, 
        exists, 
        stats, 
        duration,
        evidencePath 
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const evidence = {
        testId,
        filePath,
        timestamp: new Date().toISOString(),
        duration,
        error: error.message,
        success: false
      };
      
      const evidencePath = this.saveEvidence(testId, evidence);
      console.log(`    ❌ 检查失败: ${error.message}`);
      console.log(`    证据: ${path.basename(evidencePath)}`);
      
      return { 
        success: false, 
        error: error.message, 
        duration,
        evidencePath 
      };
    }
  }

  /**
   * 测试1: 版本系统真实测试
   */
  async test1_versionSystem() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  测试1: 版本系统真实测试 [IR-041合规]                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const tests = [
      {
        id: 'R001',
        name: '版本查询工具真实执行',
        execute: () => this.realExecute('node scripts/tools/version.cjs short', 'R001')
      },
      {
        id: 'R002',
        name: '版本文件真实验证',
        execute: () => this.realExecute('node scripts/tools/bump-version.cjs validate', 'R002')
      },
      {
        id: 'R003',
        name: '版本文件真实存在性检查',
        execute: () => this.realFileCheck('version.json', 'R003')
      },
      {
        id: 'R004',
        name: '版本API真实调用',
        execute: () => this.realAPITest('/api/version', 'R004')
      }
    ];

    for (const test of tests) {
      console.log(`  [${test.id}] ${test.name}`);
      const result = await test.execute();
      this.results.push({ ...test, result, timestamp: new Date().toISOString() });
    }
  }

  /**
   * 测试2: 自我介绍系统真实测试
   */
  async test2_introSystem() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  测试2: 自我介绍系统真实测试 [IR-041合规]                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const tests = [
      {
        id: 'R005',
        name: '完整介绍真实执行',
        execute: () => this.realExecute('node scripts/tools/self-intro.cjs', 'R005')
      },
      {
        id: 'R006',
        name: '团队介绍真实执行',
        execute: () => this.realExecute('node scripts/tools/self-intro.cjs team', 'R006')
      },
      {
        id: 'R007',
        name: '团队配置文件真实检查',
        execute: () => this.realFileCheck('team-config.json', 'R007')
      },
      {
        id: 'R008',
        name: '自我介绍API真实调用',
        execute: () => this.realAPITest('/api/intro?type=short', 'R008')
      },
      {
        id: 'R009',
        name: '团队配置API真实调用',
        execute: () => this.realAPITest('/api/team/config', 'R009')
      }
    ];

    for (const test of tests) {
      console.log(`  [${test.id}] ${test.name}`);
      const result = await test.execute();
      this.results.push({ ...test, result, timestamp: new Date().toISOString() });
    }
  }

  /**
   * 测试3: 规则引擎真实测试
   */
  async test3_ruleEngine() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  测试3: 规则引擎真实测试 [IR-041合规]                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const ruleFiles = [
      'policy/core-l1.yaml',
      'policy/dialogue-l1.yaml',
      'policy/data-format-l1.yaml',
      'policy/gui-testing-best-practices.yaml',
      'policy/version-management-l1.yaml',
      'policy/testing-standards-l1.yaml'
    ];

    for (let i = 0; i < ruleFiles.length; i++) {
      const id = `R${String(10 + i).padStart(3, '0')}`;
      console.log(`  [${id}] 真实检查: ${ruleFiles[i]}`);
      const result = await this.realFileCheck(ruleFiles[i], id);
      this.results.push({ 
        id, 
        name: `规则文件: ${ruleFiles[i]}`, 
        result, 
        timestamp: new Date().toISOString() 
      });
    }
  }

  /**
   * 测试4: 工具套件真实测试
   */
  async test4_toolSuite() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  测试4: 工具套件真实测试 [IR-041合规]                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const tools = [
      { id: 'R016', file: 'scripts/tools/version.cjs' },
      { id: 'R017', file: 'scripts/tools/bump-version.cjs' },
      { id: 'R018', file: 'scripts/tools/self-intro.cjs' },
      { id: 'R019', file: 'scripts/tools/upgrade-checklist.cjs' },
      { id: 'R020', file: 'scripts/tools/file-integrity-check.cjs' },
      { id: 'R021', file: 'scripts/tools/md-to-json-converter.cjs' }
    ];

    for (const tool of tools) {
      console.log(`  [${tool.id}] 真实检查: ${tool.file}`);
      const result = await this.realFileCheck(tool.file, tool.id);
      this.results.push({ 
        id: tool.id, 
        name: `工具: ${tool.file}`, 
        result, 
        timestamp: new Date().toISOString() 
      });
    }
  }

  /**
   * 生成真实测试报告
   */
  generateRealReport() {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.result.success).length;
    const failed = this.results.filter(r => !r.result.success).length;
    
    const report = {
      title: '真实系统测试报告',
      compliance: 'IR-041: 所有测试必须真实执行',
      timestamp: new Date().toISOString(),
      version: 'v6.1.1',
      summary: {
        total_tests: this.results.length,
        passed,
        failed,
        pass_rate: `${((passed / this.results.length) * 100).toFixed(2)}%`,
        total_duration_ms: totalDuration,
        total_duration_readable: `${(totalDuration / 1000).toFixed(2)}秒`
      },
      evidence_directory: this.evidenceDir,
      evidence_count: fs.readdirSync(this.evidenceDir).length,
      test_results: this.results,
      ir041_compliance: {
        all_tests_real: true,
        no_mocking: true,
        evidence_saved: true,
        actual_execution: true
      }
    };

    return report;
  }

  /**
   * 显示测试摘要
   */
  displaySummary() {
    console.log('\n' + '='.repeat(70));
    console.log('                   真实测试摘要 [IR-041合规]');
    console.log('='.repeat(70));
    
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.result.success).length;
    const failed = this.results.filter(r => !r.result.success).length;
    const passRate = ((passed / this.results.length) * 100).toFixed(2);
    
    console.log(`\n📊 测试统计:`);
    console.log(`  总测试数: ${this.results.length}`);
    console.log(`  通过: ${passed} ✅`);
    console.log(`  失败: ${failed} ❌`);
    console.log(`  通过率: ${passRate}%`);
    console.log(`  总耗时: ${(totalDuration / 1000).toFixed(2)}秒`);
    
    console.log(`\n📁 测试证据:`);
    const evidenceFiles = fs.readdirSync(this.evidenceDir);
    console.log(`  证据文件数: ${evidenceFiles.length}`);
    console.log(`  证据目录: ${this.evidenceDir}`);
    
    console.log(`\n✅ IR-041合规性:`);
    console.log(`  ✓ 所有测试都是真实执行`);
    console.log(`  ✓ 无任何模拟测试`);
    console.log(`  ✓ 所有证据已保存`);
    console.log(`  ✓ 实际执行时间: ${(totalDuration / 1000).toFixed(2)}秒`);
    
    if (failed > 0) {
      console.log(`\n❌ 失败的测试:`);
      this.results
        .filter(r => !r.result.success)
        .forEach(test => {
          console.log(`  • ${test.id}: ${test.name}`);
          console.log(`    错误: ${test.result.error || '未通过'}`);
        });
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(failed === 0 ? '✅ 所有真实测试通过！' : '❌ 部分测试失败，请查看详细报告');
    console.log('='.repeat(70) + '\n');
  }

  /**
   * 保存报告
   */
  saveReport() {
    const report = this.generateRealReport();
    const reportPath = path.join(__dirname, '../..', '真实测试报告.json');
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📄 真实测试报告已保存: 真实测试报告.json`);
  }

  /**
   * 运行所有真实测试
   */
  async runAll() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                ║');
    console.log('║             🔴 真实系统测试 - IR-041铁律合规                  ║');
    console.log('║                 禁止模拟，必须真实执行                         ║');
    console.log('║                                                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    await this.test1_versionSystem();
    await this.test2_introSystem();
    await this.test3_ruleEngine();
    await this.test4_toolSuite();
    
    this.displaySummary();
    this.saveReport();
  }
}

// 执行真实测试
if (require.main === module) {
  const test = new RealSystemTest();
  test.runAll().catch(error => {
    console.error('❌ 测试执行错误:', error);
    process.exit(1);
  });
}

module.exports = RealSystemTest;


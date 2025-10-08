/**
 * 系统升级前检查清单
 * 实现SYS-011升级安全规范
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

class UpgradeChecklist {
  constructor() {
    this.upgradeDir = '.upgrade';
    this.checklist = [
      {
        id: 1,
        name: '完整备份当前系统',
        command: 'git branch backup-$(date +%Y%m%d_%H%M%S)',
        description: '创建备份分支，保存当前所有更改',
        critical: true
      },
      {
        id: 2,
        name: '记录文件清单',
        command: `git ls-files > ${this.upgradeDir}/file-list-before.txt`,
        description: '记录升级前的所有文件',
        critical: true
      },
      {
        id: 3,
        name: '记录依赖版本',
        command: `npm list --depth=0 > ${this.upgradeDir}/deps-before.txt 2>&1`,
        description: '保存当前依赖版本',
        critical: true
      },
      {
        id: 4,
        name: '验证系统健康状态',
        command: 'npm run rule-engine:test',
        description: '确保当前系统正常运行',
        critical: true
      },
      {
        id: 5,
        name: '准备回滚方案',
        description: '确认回滚步骤和责任人',
        manual: true,
        critical: true
      }
    ];
  }

  /**
   * 确保升级目录存在
   */
  ensureUpgradeDir() {
    if (!fs.existsSync(this.upgradeDir)) {
      fs.mkdirSync(this.upgradeDir, { recursive: true });
      console.log(`✅ 创建升级目录: ${this.upgradeDir}`);
    }
  }

  /**
   * 执行命令
   */
  executeCommand(command) {
    try {
      const output = execSync(command, { encoding: 'utf8' });
      return { success: true, output };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 交互式运行检查清单
   */
  async runInteractive() {
    console.log('\n' + '='.repeat(70));
    console.log('                  📋 系统升级前检查清单');
    console.log('='.repeat(70) + '\n');

    this.ensureUpgradeDir();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const results = [];
    let allPassed = true;

    for (const item of this.checklist) {
      console.log(`\n${item.id}. ${item.name}`);
      console.log(`   描述: ${item.description}`);
      console.log(`   关键: ${item.critical ? '✅ 是' : '否'}`);

      if (item.manual) {
        // 手动确认项
        const answer = await new Promise(resolve => {
          rl.question(`   是否已完成? [y/n]: `, resolve);
        });

        const completed = answer.toLowerCase() === 'y';
        results.push({ ...item, completed });

        if (!completed && item.critical) {
          console.log(`   ⚠️  关键项未完成！`);
          allPassed = false;
        } else if (completed) {
          console.log(`   ✅ 已完成`);
        }

      } else if (item.command) {
        // 自动执行项
        console.log(`   命令: ${item.command}`);
        
        const answer = await new Promise(resolve => {
          rl.question(`   执行此命令? [y/n]: `, resolve);
        });

        if (answer.toLowerCase() === 'y') {
          console.log(`   ⏳ 执行中...`);
          const result = this.executeCommand(item.command);

          if (result.success) {
            console.log(`   ✅ 执行成功`);
            if (result.output && result.output.length < 200) {
              console.log(`   输出: ${result.output.substring(0, 200)}`);
            }
            results.push({ ...item, completed: true, output: result.output });
          } else {
            console.log(`   ❌ 执行失败: ${result.error}`);
            results.push({ ...item, completed: false, error: result.error });
            if (item.critical) {
              allPassed = false;
            }
          }
        } else {
          console.log(`   ⏭️  已跳过`);
          results.push({ ...item, completed: false, skipped: true });
          if (item.critical) {
            allPassed = false;
          }
        }
      }
    }

    rl.close();

    // 生成结果报告
    console.log('\n' + '='.repeat(70));
    if (allPassed) {
      console.log('✅ 所有关键检查项已完成，可以开始升级！');
    } else {
      console.log('❌ 部分关键检查项未完成，请先完成后再升级。');
      
      const failed = results.filter(r => !r.completed && r.critical);
      console.log(`\n未完成的关键项 (${failed.length}):`);
      failed.forEach(r => console.log(`  • ${r.name}`));
    }
    console.log('='.repeat(70) + '\n');

    // 保存结果
    this.saveResults(results);

    return allPassed;
  }

  /**
   * 非交互式运行
   */
  runNonInteractive() {
    console.log('\n📋 升级前检查清单（自动执行）\n');

    this.ensureUpgradeDir();

    const results = [];
    let allPassed = true;

    this.checklist.forEach(item => {
      console.log(`${item.id}. ${item.name}`);

      if (item.manual) {
        console.log(`   ⚠️  手动检查项，跳过自动执行`);
        results.push({ ...item, completed: false, manual: true });
        if (item.critical) {
          allPassed = false;
        }
      } else if (item.command) {
        const result = this.executeCommand(item.command);
        
        if (result.success) {
          console.log(`   ✅ 完成`);
          results.push({ ...item, completed: true });
        } else {
          console.log(`   ❌ 失败: ${result.error}`);
          results.push({ ...item, completed: false, error: result.error });
          if (item.critical) {
            allPassed = false;
          }
        }
      }
    });

    this.saveResults(results);

    return allPassed;
  }

  /**
   * 保存检查结果
   */
  saveResults(results) {
    const report = {
      timestamp: new Date().toISOString(),
      allPassed: results.every(r => r.completed || !r.critical),
      results
    };

    const reportPath = path.join(this.upgradeDir, 'pre-upgrade-checklist.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 检查结果已保存: ${reportPath}`);
  }

  /**
   * 显示检查清单
   */
  showChecklist() {
    console.log('\n📋 升级前检查清单:\n');
    this.checklist.forEach(item => {
      console.log(`${item.id}. ${item.name}`);
      console.log(`   ${item.description}`);
      console.log(`   关键: ${item.critical ? '是' : '否'}`);
      if (item.command) {
        console.log(`   命令: ${item.command}`);
      }
      console.log('');
    });
  }
}

// 导出
module.exports = UpgradeChecklist;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const checklist = new UpgradeChecklist();

  if (command === 'run') {
    checklist.runInteractive().then(success => {
      process.exit(success ? 0 : 1);
    });

  } else if (command === 'auto') {
    const success = checklist.runNonInteractive();
    process.exit(success ? 0 : 1);

  } else if (command === 'show') {
    checklist.showChecklist();

  } else {
    console.log(`
系统升级前检查清单

用法:
  node upgrade-checklist.cjs run    - 交互式运行检查清单
  node upgrade-checklist.cjs auto   - 自动执行检查清单
  node upgrade-checklist.cjs show   - 显示检查清单

示例:
  node upgrade-checklist.cjs run
    `);
  }
}


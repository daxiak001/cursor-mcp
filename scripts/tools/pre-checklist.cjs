/**
 * 前置检查清单系统 (IR-028)
 * 在执行操作前强制执行检查清单
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class PreChecklist {
  constructor() {
    this.checklists = {
      'code': {
        name: '编码前检查清单',
        items: [
          '已阅读相关模块文档',
          '已理解需求和预期结果',
          '已检查是否有类似功能（避免重复）',
          '已设计函数签名和接口',
          '已考虑错误处理场景',
          '已考虑边界条件',
          '已确定测试方案',
          '已确保代码风格一致'
        ]
      },
      'bugfix': {
        name: 'BUG修复前检查清单',
        items: [
          '已复现BUG',
          '已定位根本原因',
          '已评估影响范围',
          '已设计修复方案',
          '已考虑是否引入新问题',
          '已准备测试用例'
        ]
      },
      'commit': {
        name: '代码提交前检查清单',
        items: [
          '代码已完成自测',
          '已通过所有单元测试',
          '代码已格式化',
          '无调试代码残留'
        ]
      },
      'delivery': {
        name: '项目交付前检查清单',
        items: [
          '所有功能已测试',
          '文档已更新',
          '依赖已明确',
          '部署说明已提供'
        ]
      }
    };
  }

  /**
   * 交互式运行检查清单
   */
  async runInteractive(type) {
    const checklist = this.checklists[type];
    if (!checklist) {
      console.error(`❌ 未知的检查清单类型: ${type}`);
      console.log(`可用类型: ${Object.keys(this.checklists).join(', ')}`);
      return false;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${checklist.name}`);
    console.log(`${'='.repeat(60)}\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const results = [];
    let allChecked = true;

    for (let i = 0; i < checklist.items.length; i++) {
      const item = checklist.items[i];
      
      const answer = await new Promise(resolve => {
        rl.question(`${i + 1}. ${item} [y/n]: `, resolve);
      });

      const checked = answer.toLowerCase() === 'y';
      results.push({ item, checked });

      if (!checked) {
        allChecked = false;
        console.log(`   ⚠️  未完成\n`);
      } else {
        console.log(`   ✅ 完成\n`);
      }
    }

    rl.close();

    console.log(`\n${'='.repeat(60)}`);
    if (allChecked) {
      console.log(`✅ 所有检查项已完成，可以继续！`);
    } else {
      console.log(`❌ 检查清单未完成，请完成所有项目后再继续。`);
      const unchecked = results.filter(r => !r.checked);
      console.log(`\n未完成项目 (${unchecked.length}):`);
      unchecked.forEach(r => console.log(`  • ${r.item}`));
    }
    console.log(`${'='.repeat(60)}\n`);

    return allChecked;
  }

  /**
   * 非交互式检查（用于CI）
   */
  runNonInteractive(type, completedItems = []) {
    const checklist = this.checklists[type];
    if (!checklist) {
      return {
        success: false,
        message: `未知的检查清单类型: ${type}`
      };
    }

    const unchecked = checklist.items.filter(item => !completedItems.includes(item));

    return {
      success: unchecked.length === 0,
      total: checklist.items.length,
      completed: completedItems.length,
      unchecked,
      message: unchecked.length === 0 ? 
        '所有检查项已完成' : 
        `还有 ${unchecked.length} 个未完成项`
    };
  }

  /**
   * 获取检查清单
   */
  getChecklist(type) {
    return this.checklists[type] || null;
  }

  /**
   * 列出所有检查清单
   */
  listAll() {
    console.log('\n可用的检查清单:\n');
    Object.entries(this.checklists).forEach(([key, checklist]) => {
      console.log(`📋 ${key}: ${checklist.name}`);
      console.log(`   项目数: ${checklist.items.length}\n`);
    });
  }

  /**
   * 显示检查清单内容
   */
  showChecklist(type) {
    const checklist = this.checklists[type];
    if (!checklist) {
      console.error(`❌ 未知的检查清单类型: ${type}`);
      return;
    }

    console.log(`\n📋 ${checklist.name}\n`);
    checklist.items.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
    console.log('');
  }
}

// 导出
module.exports = PreChecklist;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const type = args[1];

  const checklist = new PreChecklist();

  if (command === 'run') {
    if (!type) {
      console.error('用法: node pre-checklist.cjs run <类型>');
      console.log('可用类型: code, bugfix, commit, delivery');
      process.exit(1);
    }

    checklist.runInteractive(type).then(success => {
      process.exit(success ? 0 : 1);
    });

  } else if (command === 'show') {
    if (!type) {
      checklist.listAll();
    } else {
      checklist.showChecklist(type);
    }

  } else if (command === 'list') {
    checklist.listAll();

  } else {
    console.log(`
前置检查清单系统

用法:
  node pre-checklist.cjs run <类型>    - 运行交互式检查清单
  node pre-checklist.cjs show [类型]   - 显示检查清单内容
  node pre-checklist.cjs list          - 列出所有检查清单

检查清单类型:
  code      - 编码前检查清单
  bugfix    - BUG修复前检查清单
  commit    - 代码提交前检查清单
  delivery  - 项目交付前检查清单

示例:
  node pre-checklist.cjs run code
  node pre-checklist.cjs show bugfix
    `);
  }
}


/**
 * 文件完整性检查工具
 * 用于升级后验证文件是否丢失
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FileIntegrityChecker {
  constructor() {
    this.upgradeDir = '.upgrade';
    this.beforeListFile = path.join(this.upgradeDir, 'file-list-before.txt');
    this.afterListFile = path.join(this.upgradeDir, 'file-list-after.txt');
  }

  /**
   * 获取当前文件列表
   */
  getCurrentFileList() {
    try {
      const output = execSync('git ls-files', { encoding: 'utf8' });
      return output.trim().split('\n').filter(f => f);
    } catch (error) {
      console.error('❌ 获取文件列表失败:', error.message);
      return [];
    }
  }

  /**
   * 读取升级前文件列表
   */
  getBeforeFileList() {
    if (!fs.existsSync(this.beforeListFile)) {
      console.error(`❌ 找不到升级前文件列表: ${this.beforeListFile}`);
      return null;
    }

    const content = fs.readFileSync(this.beforeListFile, 'utf8');
    return content.trim().split('\n').filter(f => f);
  }

  /**
   * 保存当前文件列表
   */
  saveCurrentFileList() {
    const files = this.getCurrentFileList();
    
    if (!fs.existsSync(this.upgradeDir)) {
      fs.mkdirSync(this.upgradeDir, { recursive: true });
    }

    fs.writeFileSync(this.afterListFile, files.join('\n'));
    console.log(`✅ 已保存当前文件列表: ${this.afterListFile}`);
    
    return files;
  }

  /**
   * 检查文件完整性
   */
  check() {
    console.log('\n' + '='.repeat(70));
    console.log('                  🔍 文件完整性检查');
    console.log('='.repeat(70) + '\n');

    // 获取升级前文件列表
    const beforeFiles = this.getBeforeFileList();
    if (!beforeFiles) {
      console.log('⚠️  无法进行完整性检查：缺少升级前文件列表');
      console.log('   建议：运行 node scripts/tools/upgrade-checklist.cjs run');
      return { success: false, reason: 'missing_before_list' };
    }

    // 获取当前文件列表
    const afterFiles = this.saveCurrentFileList();

    // 转换为Set便于查找
    const beforeSet = new Set(beforeFiles);
    const afterSet = new Set(afterFiles);

    // 检查丢失的文件
    const missingFiles = beforeFiles.filter(f => !afterSet.has(f));

    // 检查新增的文件
    const newFiles = afterFiles.filter(f => !beforeSet.has(f));

    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        before: beforeFiles.length,
        after: afterFiles.length,
        missing: missingFiles.length,
        new: newFiles.length
      },
      missingFiles,
      newFiles,
      passed: missingFiles.length === 0
    };

    // 显示结果
    console.log('📊 检查结果:\n');
    console.log(`  升级前文件数: ${report.summary.before}`);
    console.log(`  升级后文件数: ${report.summary.after}`);
    console.log(`  丢失文件数: ${report.summary.missing}`);
    console.log(`  新增文件数: ${report.summary.new}`);

    if (missingFiles.length > 0) {
      console.log(`\n❌ 发现丢失的文件 (${missingFiles.length}个):\n`);
      missingFiles.forEach(file => {
        console.log(`  • ${file}`);
      });
      console.log('\n⚠️  警告：部分文件在升级过程中丢失！');
      console.log('   建议：立即回滚或从备份恢复这些文件');
    } else {
      console.log('\n✅ 未发现文件丢失');
    }

    if (newFiles.length > 0) {
      console.log(`\n📁 新增的文件 (${newFiles.length}个):\n`);
      newFiles.slice(0, 10).forEach(file => {
        console.log(`  • ${file}`);
      });
      if (newFiles.length > 10) {
        console.log(`  ... 还有 ${newFiles.length - 10} 个文件`);
      }
    }

    // 保存报告
    const reportPath = path.join(this.upgradeDir, 'file-integrity-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 完整报告已保存: ${reportPath}`);

    console.log('\n' + '='.repeat(70) + '\n');

    return report;
  }

  /**
   * 对比具体差异
   */
  diff() {
    const beforeFiles = this.getBeforeFileList();
    if (!beforeFiles) {
      console.log('❌ 无法对比：缺少升级前文件列表');
      return;
    }

    const afterFiles = this.getCurrentFileList();

    console.log('\n📊 文件变更详情:\n');

    const beforeSet = new Set(beforeFiles);
    const afterSet = new Set(afterFiles);

    // 统计变更
    const stats = {
      unchanged: 0,
      added: 0,
      removed: 0
    };

    // 检查每个文件的状态
    const changes = [];

    beforeFiles.forEach(file => {
      if (afterSet.has(file)) {
        stats.unchanged++;
      } else {
        stats.removed++;
        changes.push({ file, status: 'removed' });
      }
    });

    afterFiles.forEach(file => {
      if (!beforeSet.has(file)) {
        stats.added++;
        changes.push({ file, status: 'added' });
      }
    });

    console.log('变更统计:');
    console.log(`  保持不变: ${stats.unchanged}`);
    console.log(`  新增: ${stats.added}`);
    console.log(`  删除: ${stats.removed}`);

    if (changes.length > 0) {
      console.log(`\n变更明细:`);
      changes.forEach(({ file, status }) => {
        const symbol = status === 'added' ? '➕' : '➖';
        console.log(`  ${symbol} ${file}`);
      });
    }

    return stats;
  }
}

// 导出
module.exports = FileIntegrityChecker;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const checker = new FileIntegrityChecker();

  if (command === 'check') {
    const result = checker.check();
    process.exit(result.passed ? 0 : 1);

  } else if (command === 'diff') {
    checker.diff();

  } else if (command === 'save') {
    checker.saveCurrentFileList();

  } else {
    console.log(`
文件完整性检查工具

用法:
  node file-integrity-check.cjs check  - 检查文件完整性
  node file-integrity-check.cjs diff   - 显示文件变更详情
  node file-integrity-check.cjs save   - 保存当前文件列表

示例:
  # 升级后检查
  node file-integrity-check.cjs check
  
  # 查看详细变更
  node file-integrity-check.cjs diff
    `);
  }
}


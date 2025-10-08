/**
 * 版本查询工具
 * 实现SYS-012版本管理规范
 */

const fs = require('fs');
const path = require('path');

class VersionManager {
  constructor() {
    this.versionFile = path.join(__dirname, '../../version.json');
  }

  /**
   * 读取版本信息
   */
  readVersion() {
    if (!fs.existsSync(this.versionFile)) {
      console.error('❌ 找不到version.json文件');
      return null;
    }

    try {
      const content = fs.readFileSync(this.versionFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ 读取版本文件失败:', error.message);
      return null;
    }
  }

  /**
   * 显示版本信息
   */
  displayVersion() {
    const versionData = this.readVersion();
    if (!versionData) {
      return;
    }

    const { 
      version, 
      release_date, 
      update_summary, 
      previous_version,
      changelog,
      statistics 
    } = versionData;

    // 格式化日期
    const releaseDate = new Date(release_date);
    const formattedDate = releaseDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    console.log('\n' + '='.repeat(70));
    console.log('                        系统版本信息');
    console.log('='.repeat(70) + '\n');

    console.log(`📦 当前版本: ${version}`);
    console.log(`📅 发布日期: ${formattedDate}`);
    console.log(`📝 更新内容: ${update_summary}`);
    console.log(`⬅️  上一版本: ${previous_version}`);

    // 统计信息
    if (statistics) {
      console.log('\n📊 变更统计:');
      console.log(`  总规则数: ${statistics.total_rules}条`);
      console.log(`  新增规则: ${statistics.new_rules}条`);
      console.log(`  总工具数: ${statistics.total_tools}个`);
      console.log(`  新增工具: ${statistics.new_tools}个`);
      if (statistics.code_lines_added) {
        console.log(`  新增代码: ${statistics.code_lines_added}行`);
      }
    }

    // 主要变更
    if (changelog && changelog.length > 0) {
      console.log('\n📋 主要变更:');
      
      const features = changelog.filter(c => c.type === 'feature');
      const tools = changelog.filter(c => c.type === 'tool');
      const fixes = changelog.filter(c => c.type === 'fix');
      const docs = changelog.filter(c => c.type === 'documentation');

      if (features.length > 0) {
        console.log(`\n  ✨ 新功能 (${features.length}项):`);
        features.forEach(item => {
          console.log(`    • ${item.description}`);
          if (item.rules) {
            console.log(`      规则: ${item.rules.join(', ')}`);
          }
        });
      }

      if (tools.length > 0) {
        console.log(`\n  🔧 新工具 (${tools.length}个):`);
        tools.forEach(item => {
          console.log(`    • ${item.description}`);
          if (item.files) {
            console.log(`      文件: ${item.files.join(', ')}`);
          }
        });
      }

      if (fixes.length > 0) {
        console.log(`\n  🐛 修复 (${fixes.length}项):`);
        fixes.forEach(item => {
          console.log(`    • ${item.description}`);
        });
      }

      if (docs.length > 0) {
        console.log(`\n  📖 文档 (${docs.length}个):`);
        docs.forEach(item => {
          console.log(`    • ${item.description}`);
        });
      }
    }

    // 检查是否最新版本（简单检查，可以扩展为远程检查）
    console.log('\n✅ 状态: 当前为本地最新版本');

    console.log('\n' + '='.repeat(70) + '\n');
  }

  /**
   * 显示简洁版本信息（用于启动日志）
   */
  displayBanner() {
    const versionData = this.readVersion();
    if (!versionData) {
      return;
    }

    const { version, release_date, update_summary } = versionData;
    const releaseDate = new Date(release_date).toLocaleDateString('zh-CN');

    console.log('╔' + '═'.repeat(68) + '╗');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('║' + `  系统版本: ${version}`.padEnd(68) + '║');
    console.log('║' + `  发布日期: ${releaseDate}`.padEnd(68) + '║');
    console.log('║' + `  更新内容: ${update_summary.substring(0, 50)}${update_summary.length > 50 ? '...' : ''}`.padEnd(68) + '║');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('╚' + '═'.repeat(68) + '╝');
  }

  /**
   * 获取版本号（供其他脚本调用）
   */
  getVersion() {
    const versionData = this.readVersion();
    return versionData ? versionData.version : 'unknown';
  }

  /**
   * 获取完整版本数据（供其他脚本调用）
   */
  getVersionData() {
    return this.readVersion();
  }

  /**
   * 验证版本格式
   */
  validateVersionFormat(version) {
    const versionRegex = /^v\d+\.\d+\.\d+$/;
    return versionRegex.test(version);
  }

  /**
   * 比较版本号
   */
  compareVersions(v1, v2) {
    const parseVersion = (v) => {
      const parts = v.replace('v', '').split('.').map(Number);
      return { major: parts[0], minor: parts[1], patch: parts[2] };
    };

    const version1 = parseVersion(v1);
    const version2 = parseVersion(v2);

    if (version1.major !== version2.major) {
      return version1.major - version2.major;
    }
    if (version1.minor !== version2.minor) {
      return version1.minor - version2.minor;
    }
    return version1.patch - version2.patch;
  }

  /**
   * 显示版本JSON（原始数据）
   */
  displayJson() {
    const versionData = this.readVersion();
    if (!versionData) {
      return;
    }

    console.log(JSON.stringify(versionData, null, 2));
  }
}

// 导出
module.exports = VersionManager;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new VersionManager();

  if (command === 'json') {
    manager.displayJson();
  } else if (command === 'banner') {
    manager.displayBanner();
  } else if (command === 'short') {
    const versionData = manager.getVersionData();
    if (versionData) {
      console.log(`${versionData.version} (${new Date(versionData.release_date).toLocaleDateString('zh-CN')})`);
    }
  } else if (command === 'compare') {
    const v1 = args[1];
    const v2 = args[2];
    
    if (!v1 || !v2) {
      console.log('用法: node version.cjs compare <version1> <version2>');
      process.exit(1);
    }

    const result = manager.compareVersions(v1, v2);
    if (result < 0) {
      console.log(`${v1} < ${v2}`);
    } else if (result > 0) {
      console.log(`${v1} > ${v2}`);
    } else {
      console.log(`${v1} = ${v2}`);
    }

  } else {
    // 默认：显示完整版本信息
    manager.displayVersion();
  }
}


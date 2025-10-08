/**
 * 版本递增工具
 * 实现SYS-012版本管理规范
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class VersionBumper {
  constructor() {
    this.versionFile = path.join(__dirname, '../../version.json');
    this.historyFile = path.join(__dirname, '../../version-history.json');
  }

  /**
   * 读取当前版本
   */
  readCurrentVersion() {
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
   * 解析版本号
   */
  parseVersion(versionString) {
    const match = versionString.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      throw new Error(`无效的版本号格式: ${versionString}`);
    }

    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3])
    };
  }

  /**
   * 递增版本号
   */
  incrementVersion(currentVersion, type) {
    const version = this.parseVersion(currentVersion);

    switch (type) {
      case 'major':
        version.major += 1;
        version.minor = 0;
        version.patch = 0;
        break;
      case 'minor':
        version.minor += 1;
        version.patch = 0;
        break;
      case 'patch':
        version.patch += 1;
        break;
      default:
        throw new Error(`无效的版本类型: ${type}`);
    }

    return `v${version.major}.${version.minor}.${version.patch}`;
  }

  /**
   * 交互式获取更新信息
   */
  async getUpdateInfo(newVersion, previousVersion) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => {
      return new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
    };

    console.log(`\n版本升级: ${previousVersion} → ${newVersion}\n`);

    const updateSummary = await question('📝 请输入更新摘要: ');
    
    const changelog = [];
    let addMore = true;
    let index = 1;

    console.log('\n📋 添加变更日志项（输入空行结束）:\n');

    while (addMore) {
      const type = await question(`  ${index}. 变更类型 (feature/fix/tool/documentation): `);
      
      if (!type.trim()) {
        addMore = false;
        break;
      }

      const description = await question(`     描述: `);
      const category = await question(`     分类: `);

      const changeItem = {
        type: type.trim(),
        category: category.trim(),
        description: description.trim()
      };

      // 可选：添加规则ID
      if (type === 'feature' || type === 'fix') {
        const rules = await question(`     相关规则 (用逗号分隔，可选): `);
        if (rules.trim()) {
          changeItem.rules = rules.split(',').map(r => r.trim());
        }
      }

      // 可选：添加文件
      if (type === 'tool' || type === 'documentation') {
        const files = await question(`     相关文件 (用逗号分隔，可选): `);
        if (files.trim()) {
          changeItem.files = files.split(',').map(f => f.trim());
        }
      }

      // 可选：影响级别
      const impact = await question(`     影响级别 (high/medium/low，可选): `);
      if (impact.trim()) {
        changeItem.impact = impact.trim();
      }

      changelog.push(changeItem);
      index++;
    }

    rl.close();

    return { updateSummary, changelog };
  }

  /**
   * 保存到版本历史
   */
  saveToHistory(versionData) {
    let history = [];

    // 读取现有历史
    if (fs.existsSync(this.historyFile)) {
      try {
        const content = fs.readFileSync(this.historyFile, 'utf8');
        history = JSON.parse(content);
      } catch (error) {
        console.warn('⚠️  读取历史文件失败，将创建新历史');
      }
    }

    // 添加新版本到历史开头
    history.unshift({
      version: versionData.version,
      release_date: versionData.release_date,
      update_summary: versionData.update_summary,
      changelog: versionData.changelog,
      statistics: versionData.statistics
    });

    // 保存历史
    fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2), 'utf8');
    console.log(`✅ 已保存到版本历史: ${this.historyFile}`);
  }

  /**
   * 递增版本（主流程）
   */
  async bump(type, auto = false) {
    console.log('\n╔' + '═'.repeat(68) + '╗');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('║' + '              版本递增工具 - SYS-012'.padEnd(68) + '║');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('╚' + '═'.repeat(68) + '╝\n');

    // 读取当前版本
    const currentData = this.readCurrentVersion();
    if (!currentData) {
      return;
    }

    const currentVersion = currentData.version;
    const newVersion = this.incrementVersion(currentVersion, type);

    console.log(`📦 当前版本: ${currentVersion}`);
    console.log(`📦 新版本: ${newVersion}`);
    console.log(`📝 递增类型: ${type}\n`);

    // 获取更新信息
    let updateInfo;
    
    if (auto) {
      // 自动模式：使用默认信息
      updateInfo = {
        updateSummary: `${type} version bump`,
        changelog: [
          {
            type: type,
            description: `Version bump to ${newVersion}`
          }
        ]
      };
    } else {
      // 交互模式：询问用户
      updateInfo = await this.getUpdateInfo(newVersion, currentVersion);
    }

    // 构建新的版本数据
    const newData = {
      ...currentData,
      version: newVersion,
      release_date: new Date().toISOString(),
      update_summary: updateInfo.updateSummary,
      previous_version: currentVersion,
      changelog: updateInfo.changelog
    };

    // 更新统计（如果有）
    if (updateInfo.changelog.length > 0) {
      const newRules = updateInfo.changelog
        .filter(c => c.rules && c.rules.length > 0)
        .reduce((sum, c) => sum + c.rules.length, 0);
      
      const newTools = updateInfo.changelog
        .filter(c => c.type === 'tool')
        .length;

      if (newData.statistics) {
        newData.statistics.new_rules = newRules;
        newData.statistics.new_tools = newTools;
      }
    }

    // 保存新版本
    fs.writeFileSync(this.versionFile, JSON.stringify(newData, null, 2), 'utf8');
    console.log(`\n✅ 版本已更新: ${this.versionFile}`);

    // 保存到历史
    this.saveToHistory(newData);

    // 显示结果
    console.log('\n' + '='.repeat(70));
    console.log('✅ 版本递增完成！');
    console.log('='.repeat(70));
    console.log(`\n新版本: ${newVersion}`);
    console.log(`发布日期: ${new Date(newData.release_date).toLocaleString('zh-CN')}`);
    console.log(`更新摘要: ${updateInfo.updateSummary}`);
    
    if (updateInfo.changelog.length > 0) {
      console.log(`\n变更项数: ${updateInfo.changelog.length}条`);
    }

    console.log('\n下一步:');
    console.log('  1. 运行测试: npm test');
    console.log('  2. 查看版本: node scripts/tools/version.cjs');
    console.log('  3. 提交代码: git add . && git commit -m "chore: bump version to ' + newVersion + '"');
    console.log('');
  }

  /**
   * 验证版本文件
   */
  validate() {
    console.log('\n📋 验证版本文件...\n');

    const versionData = this.readCurrentVersion();
    if (!versionData) {
      return false;
    }

    const errors = [];
    const warnings = [];

    // 检查必需字段
    const requiredFields = ['version', 'release_date', 'update_summary', 'previous_version'];
    requiredFields.forEach(field => {
      if (!versionData[field]) {
        errors.push(`缺少必需字段: ${field}`);
      }
    });

    // 检查版本格式
    if (versionData.version && !versionData.version.match(/^v\d+\.\d+\.\d+$/)) {
      errors.push(`版本号格式错误: ${versionData.version}（应为 vX.Y.Z）`);
    }

    // 检查日期格式
    if (versionData.release_date) {
      const date = new Date(versionData.release_date);
      if (isNaN(date.getTime())) {
        errors.push(`日期格式错误: ${versionData.release_date}`);
      }
    }

    // 检查changelog
    if (!versionData.changelog || versionData.changelog.length === 0) {
      warnings.push('changelog为空');
    }

    // 显示结果
    if (errors.length > 0) {
      console.log('❌ 验证失败:\n');
      errors.forEach(err => console.log(`  • ${err}`));
      console.log('');
      return false;
    }

    if (warnings.length > 0) {
      console.log('⚠️  警告:\n');
      warnings.forEach(warn => console.log(`  • ${warn}`));
      console.log('');
    }

    console.log('✅ 版本文件验证通过\n');
    console.log(`  版本: ${versionData.version}`);
    console.log(`  日期: ${new Date(versionData.release_date).toLocaleString('zh-CN')}`);
    console.log(`  摘要: ${versionData.update_summary}`);
    console.log('');

    return true;
  }
}

// 导出
module.exports = VersionBumper;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const bumper = new VersionBumper();

  if (command === 'validate') {
    bumper.validate();

  } else if (['major', 'minor', 'patch'].includes(command)) {
    const auto = args.includes('--auto') || args.includes('-a');
    bumper.bump(command, auto).catch(error => {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    });

  } else {
    console.log(`
版本递增工具

用法:
  node bump-version.cjs <type> [--auto]

类型:
  major  - 主版本递增 (v1.0.0 → v2.0.0)
  minor  - 次版本递增 (v1.0.0 → v1.1.0)
  patch  - 修订号递增 (v1.0.0 → v1.0.1)

选项:
  --auto, -a  - 自动模式（跳过交互）

其他命令:
  validate    - 验证版本文件

示例:
  # 交互式递增次版本
  node bump-version.cjs minor

  # 自动递增修订号
  node bump-version.cjs patch --auto

  # 验证版本文件
  node bump-version.cjs validate
    `);
  }
}


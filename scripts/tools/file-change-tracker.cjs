/**
 * 文件修改次数追踪器
 * 实现IR-032：修改3次或复杂度>10 → 强制重构
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TRACKER_FILE = path.join(__dirname, '../../.xiaoliu/file-changes.json');

class FileChangeTracker {
  constructor() {
    this.ensureTrackerFile();
    this.changes = this.load();
  }

  ensureTrackerFile() {
    const dir = path.dirname(TRACKER_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(TRACKER_FILE)) {
      fs.writeFileSync(TRACKER_FILE, JSON.stringify({}, null, 2));
    }
  }

  load() {
    try {
      const content = fs.readFileSync(TRACKER_FILE, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  save() {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(this.changes, null, 2));
  }

  /**
   * 计算文件哈希
   */
  getFileHash(filePath) {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 记录文件修改
   */
  trackChange(filePath) {
    const normalizedPath = path.normalize(filePath);
    const currentHash = this.getFileHash(filePath);
    
    if (!currentHash) {
      return null;
    }

    if (!this.changes[normalizedPath]) {
      // 首次记录
      this.changes[normalizedPath] = {
        count: 0,
        firstChange: new Date().toISOString(),
        lastChange: new Date().toISOString(),
        lastHash: currentHash,
        history: []
      };
    }

    const fileData = this.changes[normalizedPath];

    // 检查是否有实际修改
    if (fileData.lastHash !== currentHash) {
      fileData.count++;
      fileData.lastChange = new Date().toISOString();
      fileData.lastHash = currentHash;
      fileData.history.push({
        timestamp: new Date().toISOString(),
        hash: currentHash
      });

      this.save();
    }

    return {
      path: normalizedPath,
      count: fileData.count,
      firstChange: fileData.firstChange,
      lastChange: fileData.lastChange
    };
  }

  /**
   * 获取文件修改次数
   */
  getChangeCount(filePath) {
    const normalizedPath = path.normalize(filePath);
    return this.changes[normalizedPath]?.count || 0;
  }

  /**
   * 检查是否需要重构
   * @param {string} filePath - 文件路径
   * @param {number} threshold - 阈值，默认3次
   * @returns {Object} 检查结果
   */
  checkRefactorNeeded(filePath, threshold = 3) {
    const count = this.getChangeCount(filePath);
    const needsRefactor = count >= threshold;

    return {
      needsRefactor,
      changeCount: count,
      threshold,
      message: needsRefactor ? 
        `文件已修改${count}次，达到阈值${threshold}，建议重构` :
        `文件修改${count}次，未达阈值${threshold}`
    };
  }

  /**
   * 重置文件修改次数
   */
  reset(filePath) {
    const normalizedPath = path.normalize(filePath);
    if (this.changes[normalizedPath]) {
      delete this.changes[normalizedPath];
      this.save();
      return true;
    }
    return false;
  }

  /**
   * 获取所有需要重构的文件
   */
  getAllNeedingRefactor(threshold = 3) {
    return Object.entries(this.changes)
      .filter(([, data]) => data.count >= threshold)
      .map(([path, data]) => ({
        path,
        count: data.count,
        firstChange: data.firstChange,
        lastChange: data.lastChange
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 生成报告
   */
  generateReport(threshold = 3) {
    const needRefactor = this.getAllNeedingRefactor(threshold);
    const total = Object.keys(this.changes).length;
    
    let report = `
📊 文件修改追踪报告
${'='.repeat(60)}

总追踪文件数: ${total}
需要重构文件数: ${needRefactor.length}
阈值设定: ${threshold}次

`;

    if (needRefactor.length > 0) {
      report += `⚠️  需要重构的文件：\n\n`;
      needRefactor.forEach((file, index) => {
        report += `${index + 1}. ${file.path}\n`;
        report += `   修改次数: ${file.count}次\n`;
        report += `   首次修改: ${file.firstChange}\n`;
        report += `   最近修改: ${file.lastChange}\n\n`;
      });
    } else {
      report += `✅ 暂无需要重构的文件\n`;
    }

    report += `${'='.repeat(60)}\n`;
    return report;
  }
}

// 导出
module.exports = FileChangeTracker;

// CLI支持
if (require.main === module) {
  const tracker = new FileChangeTracker();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'track') {
    const filePath = args[1];
    if (!filePath) {
      console.error('用法: node file-change-tracker.cjs track <文件路径>');
      process.exit(1);
    }
    
    const result = tracker.trackChange(filePath);
    if (result) {
      console.log(`✅ 已追踪: ${result.path}`);
      console.log(`   修改次数: ${result.count}`);
      
      const check = tracker.checkRefactorNeeded(filePath);
      if (check.needsRefactor) {
        console.log(`⚠️  ${check.message}`);
        process.exit(1);
      }
    }
    
  } else if (command === 'check') {
    const filePath = args[1];
    if (!filePath) {
      console.error('用法: node file-change-tracker.cjs check <文件路径>');
      process.exit(1);
    }
    
    const result = tracker.checkRefactorNeeded(filePath);
    console.log(result.message);
    process.exit(result.needsRefactor ? 1 : 0);
    
  } else if (command === 'report') {
    const threshold = parseInt(args[1]) || 3;
    console.log(tracker.generateReport(threshold));
    
  } else if (command === 'reset') {
    const filePath = args[1];
    if (!filePath) {
      console.error('用法: node file-change-tracker.cjs reset <文件路径>');
      process.exit(1);
    }
    
    if (tracker.reset(filePath)) {
      console.log(`✅ 已重置: ${filePath}`);
    } else {
      console.log(`⚠️  文件未被追踪: ${filePath}`);
    }
    
  } else {
    console.log(`
用法:
  node file-change-tracker.cjs track <文件路径>   - 追踪文件修改
  node file-change-tracker.cjs check <文件路径>   - 检查是否需要重构
  node file-change-tracker.cjs report [阈值]      - 生成报告
  node file-change-tracker.cjs reset <文件路径>   - 重置追踪
    `);
  }
}


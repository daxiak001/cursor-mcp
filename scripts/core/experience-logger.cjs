/**
 * 自动经验记录器
 * 功能：自动检测错误和成功，智能积累知识库
 * 
 * 迁移自：xiaoliu-v6.0-full/src/tools/experienceLogger.ts
 * 增强：与监管系统整合，支持规则ID关联
 */

const fs = require('fs');
const path = require('path');
const monitor = require('./monitor-logger.cjs');

// ==================== 接口定义 ====================

/**
 * 经验条目
 */
class ExperienceEntry {
  constructor(type, description, solution = null, context = null, ruleId = null) {
    this.type = type; // 'error' | 'success'
    this.timestamp = new Date().toLocaleString('zh-CN');
    this.description = description;
    this.solution = solution;
    this.context = context;
    this.ruleId = ruleId;
    this.tags = [];
  }
}

// ==================== 经验记录器 ====================

class ExperienceLogger {
  constructor() {
    this.errorLogPath = '';
    this.successLogPath = '';
    this.autoSaveEnabled = true;
    this.initialized = false;

    // 错误关键词（中英文）
    this.errorKeywords = [
      '错误', 'error', 'bug', '失败', 'failed', '异常', 'exception',
      '问题', '无法', '不能', '没有', '报错', 'crash', '崩溃',
      '不工作', 'not work', '无效', 'invalid', '冲突', 'conflict'
    ];

    // 成功关键词
    this.successKeywords = [
      '成功', 'success', '解决', 'solved', '修复', 'fixed', '完成',
      '正常', '好了', '可以', '通过', 'works', '搞定', 'done'
    ];
  }

  /**
   * 初始化（首次使用时调用）
   */
  initialize(workspaceRoot) {
    if (this.initialized) return;

    const logDir = path.join(workspaceRoot, '.xiaoliu', 'experience');
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.errorLogPath = path.join(logDir, '错误经验.md');
    this.successLogPath = path.join(logDir, '成功经验.md');

    // 如果文件不存在，创建初始文件
    if (!fs.existsSync(this.errorLogPath)) {
      this.initializeErrorLog();
    }
    if (!fs.existsSync(this.successLogPath)) {
      this.initializeSuccessLog();
    }

    this.initialized = true;

    console.log('[经验记录] 已初始化');
    console.log(`[经验记录] 错误日志: ${this.errorLogPath}`);
    console.log(`[经验记录] 成功日志: ${this.successLogPath}`);
  }

  /**
   * 初始化错误日志文件
   */
  initializeErrorLog() {
    const content = `# 🔴 错误经验库

> 自动记录开发中遇到的错误和解决方案

**使用说明：**
- 自动检测：包含错误关键词的对话会自动记录
- 手动记录：调用API手动添加经验
- 快速搜索：通过关键词搜索历史经验

---

`;
    fs.writeFileSync(this.errorLogPath, content, 'utf-8');
  }

  /**
   * 初始化成功日志文件
   */
  initializeSuccessLog() {
    const content = `# ✅ 成功经验库

> 自动记录开发中的成功经验和最佳实践

**使用说明：**
- 自动检测：包含成功关键词的对话会自动记录
- 手动记录：调用API手动添加经验
- 快速搜索：通过关键词搜索历史经验

---

`;
    fs.writeFileSync(this.successLogPath, content, 'utf-8');
  }

  /**
   * 自动检测并记录经验
   */
  async autoDetectAndLog(message, context = null, ruleId = null) {
    if (!this.autoSaveEnabled) {
      return { logged: false };
    }

    // 确保已初始化
    if (!this.initialized) {
      this.initialize(path.join(__dirname, '..'));
    }

    const lowerMessage = message.toLowerCase();

    // 检查错误关键词
    const hasErrorKeyword = this.errorKeywords.some(kw => 
      lowerMessage.includes(kw.toLowerCase())
    );
    
    if (hasErrorKeyword) {
      const entry = this.extractExperienceFromMessage(message, 'error', context, ruleId);
      if (entry) {
        await this.logError(entry);
        
        // 记录到监控系统
        monitor.logEvent('experience_auto_log', {
          type: 'error',
          description: entry.description.substring(0, 100),
          ruleId
        }, 'info');
        
        return { logged: true, type: 'error', reason: '检测到错误关键词' };
      }
    }

    // 检查成功关键词
    const hasSuccessKeyword = this.successKeywords.some(kw => 
      lowerMessage.includes(kw.toLowerCase())
    );
    
    if (hasSuccessKeyword) {
      const entry = this.extractExperienceFromMessage(message, 'success', context, ruleId);
      if (entry) {
        await this.logSuccess(entry);
        
        // 记录到监控系统
        monitor.logEvent('experience_auto_log', {
          type: 'success',
          description: entry.description.substring(0, 100),
          ruleId
        }, 'info');
        
        return { logged: true, type: 'success', reason: '检测到成功关键词' };
      }
    }

    return { logged: false };
  }

  /**
   * 从消息中提取经验信息
   */
  extractExperienceFromMessage(message, type, context = null, ruleId = null) {
    const lines = message.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) return null;

    const description = lines[0].substring(0, 200); // 取第一行为描述
    const solution = lines.length > 1 ? lines.slice(1).join('\n').substring(0, 500) : null;

    const entry = new ExperienceEntry(type, description, solution, context, ruleId);
    entry.tags = this.extractTags(message);
    
    return entry;
  }

  /**
   * 提取标签
   */
  extractTags(message) {
    const tags = [];
    const lowerMessage = message.toLowerCase();

    // 技术栈标签
    const techKeywords = {
      'node': 'Node.js',
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'react': 'React',
      'vue': 'Vue',
      'python': 'Python',
      'database': '数据库',
      'sql': 'SQL',
      'api': 'API',
      'git': 'Git',
      'npm': 'NPM',
      'docker': 'Docker'
    };

    for (const [keyword, tag] of Object.entries(techKeywords)) {
      if (lowerMessage.includes(keyword)) {
        tags.push(tag);
      }
    }

    // 问题类型标签
    if (lowerMessage.includes('超时') || lowerMessage.includes('timeout')) tags.push('超时');
    if (lowerMessage.includes('权限') || lowerMessage.includes('permission')) tags.push('权限');
    if (lowerMessage.includes('连接') || lowerMessage.includes('connection')) tags.push('连接');
    if (lowerMessage.includes('配置') || lowerMessage.includes('config')) tags.push('配置');
    if (lowerMessage.includes('性能') || lowerMessage.includes('performance')) tags.push('性能');

    return tags;
  }

  /**
   * 记录错误经验
   */
  async logError(entry) {
    const timestamp = new Date().toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    let content = `\n## 🔴 ${entry.description}\n\n`;
    content += `**时间：** ${timestamp}\n\n`;
    
    if (entry.ruleId) {
      content += `**规则：** ${entry.ruleId}\n\n`;
    }
    
    if (entry.solution) {
      content += `**解决方案：**\n\n${entry.solution}\n\n`;
    }
    
    if (entry.context) {
      content += `**上下文：** ${entry.context}\n\n`;
    }
    
    if (entry.tags && entry.tags.length > 0) {
      content += `**标签：** ${entry.tags.map(t => `\`${t}\``).join(' ')}\n\n`;
    }
    
    content += `---\n`;

    fs.appendFileSync(this.errorLogPath, content, 'utf-8');
    console.log('[经验记录] ✓ 错误经验已记录');
  }

  /**
   * 记录成功经验
   */
  async logSuccess(entry) {
    const timestamp = new Date().toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    let content = `\n## ✅ ${entry.description}\n\n`;
    content += `**时间：** ${timestamp}\n\n`;
    
    if (entry.ruleId) {
      content += `**规则：** ${entry.ruleId}\n\n`;
    }
    
    if (entry.solution) {
      content += `**实现方法：**\n\n${entry.solution}\n\n`;
    }
    
    if (entry.context) {
      content += `**上下文：** ${entry.context}\n\n`;
    }
    
    if (entry.tags && entry.tags.length > 0) {
      content += `**标签：** ${entry.tags.map(t => `\`${t}\``).join(' ')}\n\n`;
    }
    
    content += `---\n`;

    fs.appendFileSync(this.successLogPath, content, 'utf-8');
    console.log('[经验记录] ✓ 成功经验已记录');
  }

  /**
   * 搜索经验
   */
  async searchExperience(keyword, type = 'all') {
    if (!this.initialized) {
      this.initialize(path.join(__dirname, '..'));
    }

    const results = [];

    // 搜索错误经验
    if (type === 'all' || type === 'error') {
      if (fs.existsSync(this.errorLogPath)) {
        const content = fs.readFileSync(this.errorLogPath, 'utf-8');
        const matches = this.searchInContent(content, keyword, 'error');
        results.push(...matches);
      }
    }

    // 搜索成功经验
    if (type === 'all' || type === 'success') {
      if (fs.existsSync(this.successLogPath)) {
        const content = fs.readFileSync(this.successLogPath, 'utf-8');
        const matches = this.searchInContent(content, keyword, 'success');
        results.push(...matches);
      }
    }

    return results;
  }

  /**
   * 在内容中搜索
   */
  searchInContent(content, keyword, type) {
    const results = [];
    const sections = content.split('---').filter(s => s.trim());
    
    const lowerKeyword = keyword.toLowerCase();

    for (const section of sections) {
      if (section.toLowerCase().includes(lowerKeyword)) {
        // 提取标题
        const titleMatch = section.match(/##\s+[🔴✅]\s+(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : '未知';
        
        // 提取时间
        const timeMatch = section.match(/\*\*时间：\*\*\s+(.+)/);
        const time = timeMatch ? timeMatch[1].trim() : '';
        
        // 提取解决方案/实现方法
        const solutionMatch = section.match(/\*\*(解决方案|实现方法)：\*\*\n\n(.+?)(?:\n\n|\n$)/s);
        const solution = solutionMatch ? solutionMatch[2].trim() : '';
        
        results.push({
          type,
          title,
          time,
          solution: solution.substring(0, 200),
          snippet: section.substring(0, 300)
        });
      }
    }

    return results;
  }

  /**
   * 获取统计信息
   */
  async getStatistics() {
    if (!this.initialized) {
      this.initialize(path.join(__dirname, '..'));
    }

    const stats = {
      errorCount: 0,
      successCount: 0,
      totalCount: 0,
      recentErrors: [],
      recentSuccesses: []
    };

    // 统计错误经验
    if (fs.existsSync(this.errorLogPath)) {
      const content = fs.readFileSync(this.errorLogPath, 'utf-8');
      const sections = content.split('---').filter(s => s.trim() && s.includes('##'));
      stats.errorCount = sections.length;
      
      // 最近3条
      stats.recentErrors = sections.slice(-3).reverse().map(s => {
        const titleMatch = s.match(/##\s+[🔴]\s+(.+)/);
        return titleMatch ? titleMatch[1].trim() : '';
      });
    }

    // 统计成功经验
    if (fs.existsSync(this.successLogPath)) {
      const content = fs.readFileSync(this.successLogPath, 'utf-8');
      const sections = content.split('---').filter(s => s.trim() && s.includes('##'));
      stats.successCount = sections.length;
      
      // 最近3条
      stats.recentSuccesses = sections.slice(-3).reverse().map(s => {
        const titleMatch = s.match(/##\s+[✅]\s+(.+)/);
        return titleMatch ? titleMatch[1].trim() : '';
      });
    }

    stats.totalCount = stats.errorCount + stats.successCount;

    return stats;
  }

  /**
   * 启用/禁用自动保存
   */
  setAutoSaveEnabled(enabled) {
    this.autoSaveEnabled = enabled;
    console.log(`[经验记录] 自动保存${enabled ? '已启用' : '已禁用'}`);
  }
}

// ==================== 单例模式 ====================

let instance = null;

function getInstance() {
  if (!instance) {
    instance = new ExperienceLogger();
  }
  return instance;
}

// ==================== 导出API ====================

module.exports = {
  /**
   * 获取实例
   */
  getInstance,

  /**
   * 自动检测并记录
   */
  autoDetectAndLog: (message, context, ruleId) => 
    getInstance().autoDetectAndLog(message, context, ruleId),

  /**
   * 记录错误经验
   */
  logError: (entry) => getInstance().logError(entry),

  /**
   * 记录成功经验
   */
  logSuccess: (entry) => getInstance().logSuccess(entry),

  /**
   * 搜索经验
   */
  searchExperience: (keyword, type) => getInstance().searchExperience(keyword, type),

  /**
   * 获取统计
   */
  getStatistics: () => getInstance().getStatistics(),

  /**
   * 设置自动保存
   */
  setAutoSaveEnabled: (enabled) => getInstance().setAutoSaveEnabled(enabled),

  /**
   * 初始化
   */
  initialize: (workspaceRoot) => getInstance().initialize(workspaceRoot),

  /**
   * ExperienceEntry类（供外部使用）
   */
  ExperienceEntry
};


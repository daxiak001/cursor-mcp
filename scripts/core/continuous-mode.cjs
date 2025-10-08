/**
 * 连续执行模式控制器
 * 功能：强制AI持续执行，防止中断询问用户
 * 
 * 迁移自：xiaoliu-v6.0-full/src/tools/continuousMode.ts
 * 增强：集成到规则引擎，支持状态持久化
 */

const fs = require('fs');
const path = require('path');
const monitor = require('./monitor-logger.cjs');

// ==================== 接口定义 ====================

/**
 * 连续执行模式状态
 */
class ContinuousModeState {
  constructor() {
    this.enabled = false;
    this.startTime = 0;
    this.taskDescription = '';
    this.stopPhrases = [];
    this.sessionId = '';
  }
}

// ==================== 连续执行模式控制器 ====================

class ContinuousModeController {
  constructor() {
    this.state = new ContinuousModeState();
    this.stateFile = path.join(__dirname, '../.xiaoliu/continuous-mode-state.json');
    this.loadState();
  }

  /**
   * 加载持久化状态
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, 'utf8');
        const savedState = JSON.parse(data);
        
        // 检查会话是否过期（超过24小时）
        const now = Date.now();
        if (savedState.enabled && savedState.startTime && (now - savedState.startTime) < 24 * 60 * 60 * 1000) {
          this.state = Object.assign(new ContinuousModeState(), savedState);
          console.log('[连续模式] 恢复之前的会话');
        }
      }
    } catch (error) {
      console.error('[连续模式] 加载状态失败:', error.message);
    }
  }

  /**
   * 保存状态到文件
   */
  saveState() {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (error) {
      console.error('[连续模式] 保存状态失败:', error.message);
    }
  }

  /**
   * 获取默认停止短语
   */
  getDefaultStopPhrases() {
    return [
      '停止连续执行',
      '暂停连续模式',
      '结束连续执行',
      'stop continuous',
      'pause continuous'
    ];
  }

  /**
   * 检查是否处于连续模式
   */
  isEnabled() {
    return this.state.enabled;
  }

  /**
   * 获取当前状态
   */
  getState() {
    return {
      ...this.state,
      duration: this.state.enabled ? Date.now() - this.state.startTime : 0,
      durationMinutes: this.state.enabled ? ((Date.now() - this.state.startTime) / 1000 / 60).toFixed(1) : 0
    };
  }

  /**
   * 启动连续执行模式
   */
  enable(taskDescription) {
    const sessionId = `session-${Date.now()}`;
    
    this.state = {
      enabled: true,
      startTime: Date.now(),
      taskDescription: taskDescription || '未指定任务',
      stopPhrases: this.getDefaultStopPhrases(),
      sessionId
    };

    this.saveState();

    // 记录监控日志
    monitor.logEvent('continuous_mode', {
      action: 'enable',
      sessionId,
      taskDescription: this.state.taskDescription
    }, 'info');

    console.log('[连续模式] 🚀 强制连续执行模式已启动');
    console.log(`[连续模式] 任务: ${taskDescription}`);

    return {
      success: true,
      message: `🚀 连续执行辅助模式已启动

任务: ${taskDescription}

实际效果：
✓ 减少AI询问次数（预期减少60-70%）
✓ AI会在一个回复中完成更多子任务
✓ 遇到小问题AI会自主决策
⚠️ 复杂决策时AI仍可能停下询问

使用建议：
• 任务描述要详细明确
• AI询问时可快速回复"继续"或"y"
• 定期查看进度，及时纠正方向

技术说明：
此模式通过提示词增强和规则检查来减少中断，
但受限于AI机制，无法完全杜绝询问。

会话ID: ${sessionId}
模式已激活 ⚡`,
      sessionId,
      state: this.getState(),
      enhancedPrompt: this.getEnhancedPrompt()
    };
  }

  /**
   * 停止连续执行模式
   */
  disable() {
    if (!this.state.enabled) {
      return {
        success: false,
        message: '⚠️ 连续执行模式未启动',
        state: this.getState()
      };
    }

    const duration = ((Date.now() - this.state.startTime) / 1000 / 60).toFixed(1);
    const task = this.state.taskDescription;
    const sessionId = this.state.sessionId;

    // 记录监控日志
    monitor.logEvent('continuous_mode', {
      action: 'disable',
      sessionId,
      taskDescription: task,
      duration: parseFloat(duration)
    }, 'info');

    this.state = new ContinuousModeState();
    this.saveState();

    console.log('[连续模式] ⏸️ 强制连续执行模式已停止');

    return {
      success: true,
      message: `⏸️ 连续执行模式已停止

任务: ${task}
运行时长: ${duration} 分钟

模式已关闭，AI恢复正常交互模式。`,
      duration: parseFloat(duration),
      task,
      sessionId,
      state: this.getState()
    };
  }

  /**
   * 检查消息是否包含停止短语
   */
  shouldStop(message) {
    if (!this.state.enabled) {
      return false;
    }

    const lowerMessage = message.toLowerCase();
    return this.state.stopPhrases.some(phrase => 
      lowerMessage.includes(phrase.toLowerCase())
    );
  }

  /**
   * 获取状态信息
   */
  getStatusInfo() {
    if (!this.state.enabled) {
      return {
        enabled: false,
        message: '⏸️ 连续执行模式未启动\n\n使用方法：\n启动: POST /api/continuous-mode/enable\n停止: POST /api/continuous-mode/disable'
      };
    }

    const duration = ((Date.now() - this.state.startTime) / 1000 / 60).toFixed(1);
    
    return {
      enabled: true,
      taskDescription: this.state.taskDescription,
      duration: parseFloat(duration),
      sessionId: this.state.sessionId,
      message: `🚀 连续执行模式运行中

任务: ${this.state.taskDescription}
运行时长: ${duration} 分钟
会话ID: ${this.state.sessionId}

状态: 全速推进中 ⚡`
    };
  }

  /**
   * 获取增强提示词（注入到AI对话中）
   */
  getEnhancedPrompt() {
    if (!this.state.enabled) {
      return '';
    }

    return `
╔════════════════════════════════════════════════════════════╗
║  ⚡ 连续执行辅助模式已激活                                  ║
╠════════════════════════════════════════════════════════════╣
║  当前任务: ${this.state.taskDescription.padEnd(48)}║
║                                                            ║
║  执行策略（请严格遵守）：                                   ║
║  1. 📋 在本次回复中尽可能完成2-5个子任务                   ║
║  2. 🚫 禁止询问"是否"、"要不要"、"需要吗"等问题            ║
║  3. 💡 遇到问题自主决策，说明理由后继续                    ║
║  4. ⏭️  完成一个子任务后立即开始下一个                     ║
║  5. 📝 每个子任务完成后简要说明并继续                      ║
║                                                            ║
║  期望行为模式：                                             ║
║  ✓ 一次回复 = 分析 + 实现 + 测试 + 下一步                 ║
║  ✓ 主动规划接下来的2-3步                                   ║
║  ✓ 遇到小问题：说明 + 解决方案 + 继续                     ║
║  ✗ 避免：完成一步就停下来询问                              ║
║                                                            ║
║  示例（好的行为）：                                         ║
║  "创建用户表...✓ 创建角色表...✓ 实现RBAC...✓              ║
║   下一步：添加权限验证中间件"                               ║
║                                                            ║
║  示例（要避免）：                                           ║
║  "创建用户表已完成，是否继续创建角色表？" ✗                ║
╚════════════════════════════════════════════════════════════╝
`;
  }

  /**
   * 检查并拦截询问语句
   * 集成到规则引擎的对话检查中
   */
  checkAndBlockQuestions(message) {
    if (!this.state.enabled) {
      return { shouldBlock: false };
    }

    // 检查是否包含询问关键词
    const questionKeywords = [
      '是否', '要不要', '需要吗', '可以吗', '行吗',
      '是不是', '好不好', '要吗', '继续吗', '执行吗'
    ];

    const hasQuestion = questionKeywords.some(kw => message.includes(kw));
    
    if (hasQuestion) {
      // 记录拦截
      monitor.logViolation(
        'CONTINUOUS-MODE-001',
        'question_in_continuous_mode',
        {
          message: message.substring(0, 100),
          taskDescription: this.state.taskDescription
        },
        '连续模式下禁止询问，应直接执行'
      );

      return {
        shouldBlock: true,
        reason: '连续执行模式下禁止询问用户',
        suggestion: '请直接执行，不要询问"是否继续"等问题',
        taskDescription: this.state.taskDescription
      };
    }

    return { shouldBlock: false };
  }

  /**
   * 重置状态（用于测试或异常恢复）
   */
  reset() {
    this.state = new ContinuousModeState();
    this.saveState();
    
    console.log('[连续模式] 状态已重置');
    
    return {
      success: true,
      message: '连续执行模式状态已重置'
    };
  }
}

// ==================== 单例模式 ====================

let instance = null;

function getInstance() {
  if (!instance) {
    instance = new ContinuousModeController();
  }
  return instance;
}

// ==================== 导出API ====================

module.exports = {
  /**
   * 获取控制器实例
   */
  getController: getInstance,

  /**
   * 启动连续执行模式
   */
  enable: (taskDescription) => getInstance().enable(taskDescription),

  /**
   * 停止连续执行模式
   */
  disable: () => getInstance().disable(),

  /**
   * 检查是否启用
   */
  isEnabled: () => getInstance().isEnabled(),

  /**
   * 获取状态
   */
  getState: () => getInstance().getState(),

  /**
   * 获取状态信息
   */
  getStatusInfo: () => getInstance().getStatusInfo(),

  /**
   * 检查是否应该停止
   */
  shouldStop: (message) => getInstance().shouldStop(message),

  /**
   * 检查并拦截询问
   */
  checkAndBlockQuestions: (message) => getInstance().checkAndBlockQuestions(message),

  /**
   * 获取增强提示词
   */
  getEnhancedPrompt: () => getInstance().getEnhancedPrompt(),

  /**
   * 重置状态
   */
  reset: () => getInstance().reset()
};


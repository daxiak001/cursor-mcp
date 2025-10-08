/**
 * MCP集成模块
 * 
 * 功能：
 * 1. 将AutoContinueInjector和SmartTodoParser集成到MCP服务端
 * 2. 提供统一的拦截接口
 * 3. 支持任何MCP服务端实现
 * 
 * 使用方式：
 * const { interceptAIResponse } = require('./mcp-integration.cjs');
 * 
 * // 在MCP服务端的respondToUser工具中调用
 * const result = await interceptAIResponse(aiResponse, context);
 */

const AutoContinueInjector = require('./auto-continue-injector.cjs');
const SmartTodoParser = require('../scripts/core/todo-parser-smart.cjs');
const fs = require('fs');
const path = require('path');

class MCPIntegration {
  constructor(config = {}) {
    // 初始化自动续航注入器
    this.autoContinue = new AutoContinueInjector({
      enabled: config.autoContinueEnabled !== false,
      delayMs: config.autoContinueDelay || 500,
      maxAutoRetries: config.maxAutoRetries || 10,
      logEnabled: config.logEnabled !== false,
      dryRun: config.dryRun || false
    });
    
    // 初始化TODO解析器
    this.todoParser = new SmartTodoParser({
      enableTokenEstimate: config.enableTokenEstimate !== false,
      enableMicroTaskSplit: config.enableMicroTaskSplit !== false,
      maxTokensPerTask: config.maxTokensPerTask || 1000,
      logEnabled: config.logEnabled !== false
    });
    
    // 配置
    this.config = {
      enabled: config.enabled !== false,
      persistTodos: config.persistTodos !== false,
      todoStorePath: config.todoStorePath || path.join(__dirname, '../data/todos.json'),
      logEnabled: config.logEnabled !== false
    };
    
    // 当前TODO执行计划
    this.currentPlan = null;
    this.currentTaskIndex = 0;
    
    // 统计
    this.stats = {
      totalInterceptions: 0,
      autoContinueTriggered: 0,
      todosDetected: 0,
      plansGenerated: 0
    };
    
    this.ensureDataDir();
  }
  
  /**
   * 确保数据目录存在
   */
  ensureDataDir() {
    const dataDir = path.dirname(this.config.todoStorePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }
  
  /**
   * 拦截AI响应（主入口）
   */
  async interceptAIResponse(aiResponse, context = {}) {
    if (!this.config.enabled) {
      return {
        modified: false,
        originalResponse: aiResponse
      };
    }
    
    this.stats.totalInterceptions++;
    
    const result = {
      originalResponse: aiResponse,
      modified: false,
      autoContinue: null,
      todoPlan: null,
      warnings: [],
      timestamp: new Date().toISOString()
    };
    
    try {
      // 1. 检查TODO清单
      const todoResult = await this.detectAndParseTodos(context.userMessage || '', aiResponse);
      if (todoResult.detected) {
        result.todoPlan = todoResult.plan;
        result.modified = true;
        this.stats.todosDetected++;
        this.stats.plansGenerated++;
      }
      
      // 2. 检查自动续航信号
      const continueResult = await this.autoContinue.interceptResponse(
        aiResponse, 
        {
          ...context,
          autoContinueCount: context.autoContinueCount || 0,
          mcpSendMessage: context.sendMessage,
          cursorCLI: context.cursorCLI
        }
      );
      
      if (continueResult.autoContinued) {
        result.autoContinue = continueResult;
        result.modified = true;
        this.stats.autoContinueTriggered++;
      }
      
      // 3. 生成增强响应
      if (result.modified) {
        result.enhancedResponse = this.generateEnhancedResponse(aiResponse, result);
      }
      
      // 4. 持久化TODO计划
      if (result.todoPlan && this.config.persistTodos) {
        this.saveTodoPlan(result.todoPlan);
      }
      
      return result;
      
    } catch (error) {
      this.log('错误', `拦截失败: ${error.message}`);
      result.warnings.push({
        level: 'error',
        message: error.message,
        stack: error.stack
      });
      return result;
    }
  }
  
  /**
   * 检测并解析TODO清单
   */
  async detectAndParseTodos(userMessage, aiResponse) {
    // 检测用户消息中的TODO
    const userTodos = this.todoParser.parse(userMessage);
    
    // 检测AI响应中的TODO（如AI主动提出的任务清单）
    const aiTodos = this.todoParser.parse(aiResponse);
    
    const allTodos = [...userTodos, ...aiTodos];
    
    if (allTodos.length === 0) {
      return { detected: false };
    }
    
    // 生成执行计划
    const plan = this.todoParser.generateExecutionPlan(allTodos);
    
    // 设置为当前计划
    this.currentPlan = plan;
    this.currentTaskIndex = 0;
    
    this.log('TODO', `检测到${allTodos.length}个任务，生成执行计划（${plan.microTasks.length}个微任务批次）`);
    
    return {
      detected: true,
      plan,
      todos: allTodos,
      source: {
        fromUser: userTodos.length,
        fromAI: aiTodos.length
      }
    };
  }
  
  /**
   * 生成增强响应
   */
  generateEnhancedResponse(originalResponse, interceptResult) {
    let enhanced = originalResponse;
    
    // 添加TODO计划说明
    if (interceptResult.todoPlan) {
      const plan = interceptResult.todoPlan;
      const planSummary = `\n\n---\n📋 **执行计划已生成**\n` +
        `- 总任务: ${plan.totalTasks}个\n` +
        `- 预估Token: ${plan.estimatedTotalTokens}\n` +
        `- 微任务批次: ${plan.microTasks.length}个\n` +
        `- 自动续航: ${plan.microTasks.filter(m => m.autoContinue).length}个批次\n` +
        `---\n`;
      
      enhanced += planSummary;
    }
    
    // 添加自动续航提示
    if (interceptResult.autoContinue && interceptResult.autoContinue.autoContinued) {
      const continueInfo = `\n\n⚡ **自动续航已触发** (${interceptResult.autoContinue.retryCount}/${this.autoContinue.config.maxAutoRetries})\n`;
      enhanced += continueInfo;
    }
    
    return enhanced;
  }
  
  /**
   * 保存TODO计划
   */
  saveTodoPlan(plan) {
    try {
      const planData = {
        plan,
        createdAt: new Date().toISOString(),
        currentTaskIndex: this.currentTaskIndex,
        status: 'active'
      };
      
      // 读取现有计划
      let allPlans = [];
      if (fs.existsSync(this.config.todoStorePath)) {
        const data = fs.readFileSync(this.config.todoStorePath, 'utf8');
        allPlans = JSON.parse(data);
      }
      
      // 添加新计划
      allPlans.push(planData);
      
      // 保存
      fs.writeFileSync(
        this.config.todoStorePath,
        JSON.stringify(allPlans, null, 2),
        'utf8'
      );
      
      this.log('持久化', `TODO计划已保存到 ${this.config.todoStorePath}`);
      
    } catch (error) {
      this.log('错误', `保存TODO计划失败: ${error.message}`);
    }
  }
  
  /**
   * 加载最新TODO计划
   */
  loadLatestPlan() {
    try {
      if (!fs.existsSync(this.config.todoStorePath)) {
        return null;
      }
      
      const data = fs.readFileSync(this.config.todoStorePath, 'utf8');
      const allPlans = JSON.parse(data);
      
      // 返回最新的活跃计划
      const activePlans = allPlans.filter(p => p.status === 'active');
      return activePlans.length > 0 ? activePlans[activePlans.length - 1] : null;
      
    } catch (error) {
      this.log('错误', `加载TODO计划失败: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 获取当前任务
   */
  getCurrentTask() {
    if (!this.currentPlan || this.currentTaskIndex >= this.currentPlan.totalTasks) {
      return null;
    }
    
    return this.currentPlan.tasks[this.currentTaskIndex];
  }
  
  /**
   * 标记任务完成，移到下一个
   */
  completeCurrentTask() {
    if (!this.currentPlan) {
      return false;
    }
    
    const task = this.getCurrentTask();
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      this.currentTaskIndex++;
      
      // 更新持久化
      if (this.config.persistTodos) {
        this.updatePlanInStorage();
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * 更新存储中的计划
   */
  updatePlanInStorage() {
    try {
      if (!fs.existsSync(this.config.todoStorePath)) {
        return;
      }
      
      const data = fs.readFileSync(this.config.todoStorePath, 'utf8');
      const allPlans = JSON.parse(data);
      
      // 更新最新计划
      if (allPlans.length > 0) {
        allPlans[allPlans.length - 1] = {
          plan: this.currentPlan,
          createdAt: allPlans[allPlans.length - 1].createdAt,
          currentTaskIndex: this.currentTaskIndex,
          status: this.currentTaskIndex >= this.currentPlan.totalTasks ? 'completed' : 'active',
          updatedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(
          this.config.todoStorePath,
          JSON.stringify(allPlans, null, 2),
          'utf8'
        );
      }
      
    } catch (error) {
      this.log('错误', `更新TODO计划失败: ${error.message}`);
    }
  }
  
  /**
   * 获取统计数据
   */
  getStats() {
    return {
      ...this.stats,
      autoContinueStats: this.autoContinue.getStats(),
      todoParserStats: this.todoParser.getStats(),
      currentPlan: this.currentPlan ? {
        totalTasks: this.currentPlan.totalTasks,
        currentIndex: this.currentTaskIndex,
        progress: `${this.currentTaskIndex}/${this.currentPlan.totalTasks}`,
        percentage: ((this.currentTaskIndex / this.currentPlan.totalTasks) * 100).toFixed(1) + '%'
      } : null
    };
  }
  
  /**
   * 生成执行报告
   */
  generateReport() {
    const stats = this.getStats();
    
    return {
      summary: {
        totalInterceptions: stats.totalInterceptions,
        autoContinueTriggered: stats.autoContinueTriggered,
        todosDetected: stats.todosDetected,
        plansGenerated: stats.plansGenerated,
        autoContinueRate: stats.totalInterceptions > 0
          ? `${((stats.autoContinueTriggered / stats.totalInterceptions) * 100).toFixed(1)}%`
          : '0%'
      },
      currentProgress: stats.currentPlan,
      subSystemStats: {
        autoContinue: stats.autoContinueStats,
        todoParser: stats.todoParserStats
      },
      recommendations: this.generateRecommendations(stats)
    };
  }
  
  /**
   * 生成优化建议
   */
  generateRecommendations(stats) {
    const recommendations = [];
    
    const autoContinueRate = stats.totalInterceptions > 0
      ? (stats.autoContinueTriggered / stats.totalInterceptions) * 100
      : 0;
    
    if (autoContinueRate < 10 && stats.totalInterceptions > 10) {
      recommendations.push({
        level: 'warning',
        message: `自动续航触发率低(${autoContinueRate.toFixed(1)}%)，AI可能未输出续航信号`,
        suggestion: '检查AI是否使用了⚡继续等关键词，或调整续航信号正则表达式'
      });
    }
    
    if (stats.todosDetected === 0 && stats.totalInterceptions > 5) {
      recommendations.push({
        level: 'info',
        message: '未检测到TODO清单，可能用户未提供任务列表',
        suggestion: '引导用户使用Markdown复选框格式（- [ ] 任务）或数字列表'
      });
    }
    
    if (autoContinueRate > 80) {
      recommendations.push({
        level: 'success',
        message: `自动续航运行良好(${autoContinueRate.toFixed(1)}%)，系统高度自动化`,
        suggestion: '继续保持当前配置'
      });
    }
    
    return recommendations;
  }
  
  /**
   * 日志
   */
  log(level, message) {
    if (!this.config.logEnabled) return;
    console.log(`[MCP集成] [${level}] ${message}`);
  }
  
  /**
   * 重置状态
   */
  reset() {
    this.currentPlan = null;
    this.currentTaskIndex = 0;
    this.autoContinue.resetStats();
    this.stats = {
      totalInterceptions: 0,
      autoContinueTriggered: 0,
      todosDetected: 0,
      plansGenerated: 0
    };
    this.log('系统', '状态已重置');
  }
}

// 导出
module.exports = MCPIntegration;

// 便捷函数：供MCP服务端直接调用
let globalInstance = null;

function getGlobalInstance(config) {
  if (!globalInstance) {
    globalInstance = new MCPIntegration(config);
  }
  return globalInstance;
}

async function interceptAIResponse(aiResponse, context = {}) {
  const instance = getGlobalInstance(context.config);
  return await instance.interceptAIResponse(aiResponse, context);
}

function getStats() {
  const instance = getGlobalInstance();
  return instance.getStats();
}

function generateReport() {
  const instance = getGlobalInstance();
  return instance.generateReport();
}

function resetIntegration() {
  const instance = getGlobalInstance();
  instance.reset();
}

module.exports = MCPIntegration;
module.exports.interceptAIResponse = interceptAIResponse;
module.exports.getStats = getStats;
module.exports.generateReport = generateReport;
module.exports.resetIntegration = resetIntegration;

// CLI测试
if (require.main === module) {
  const integration = new MCPIntegration({ dryRun: true });
  
  // 模拟场景
  (async () => {
    console.log('\n========== MCP集成测试 ==========\n');
    
    // 场景1: 用户提供TODO清单
    console.log('--- 场景1: TODO清单检测 ---\n');
    const userMessage1 = `请完成以下任务：
- [ ] 创建User模型
- [ ] 实现登录API
- [ ] 编写测试用例`;
    
    const aiResponse1 = '✅ 理解您的需求，开始执行...\n创建User模型...';
    
    const result1 = await integration.interceptAIResponse(aiResponse1, { userMessage: userMessage1 });
    console.log('结果1:', JSON.stringify(result1, null, 2));
    
    // 场景2: AI输出续航信号
    console.log('\n--- 场景2: 自动续航检测 ---\n');
    const aiResponse2 = '✅ 第1段完成（User模型）\n⚡ 继续第2段（登录API）...';
    
    const result2 = await integration.interceptAIResponse(aiResponse2, {
      userMessage: userMessage1,
      autoContinueCount: 0
    });
    console.log('结果2:', JSON.stringify(result2, null, 2));
    
    // 场景3: 批量任务进度
    console.log('\n--- 场景3: 批量任务 ---\n');
    const aiResponse3 = '✅ 已完成 10/50 个文件\n⚡ 继续处理第11个...';
    
    const result3 = await integration.interceptAIResponse(aiResponse3, {
      autoContinueCount: 1
    });
    console.log('结果3:', JSON.stringify(result3, null, 2));
    
    // 生成报告
    console.log('\n========== 执行报告 ==========\n');
    const report = integration.generateReport();
    console.log(JSON.stringify(report, null, 2));
  })();
}


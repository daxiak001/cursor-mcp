/**
 * 微任务自动拆分引擎
 * 
 * 功能：
 * 1. 智能分析任务结构和复杂度
 * 2. 自动拆分为<1000 token的微任务
 * 3. Token精准估算
 * 4. 依赖关系分析
 * 5. 执行顺序优化
 * 
 * 优先级：P1 - 重要改进
 * 预期效果：自动拆分任务，永不触发Token限制
 */

const fs = require('fs');
const path = require('path');

class MicroTaskSplitter {
  constructor(config = {}) {
    this.config = {
      maxTokensPerTask: config.maxTokensPerTask || 1000,
      minTokensPerTask: config.minTokensPerTask || 200,
      enableSmartSplit: config.enableSmartSplit !== false,
      enableDependencyAnalysis: config.enableDependencyAnalysis !== false,
      enablePrioritySort: config.enablePrioritySort !== false,
      logEnabled: config.logEnabled !== false
    };
    
    // 任务模式库（预定义常见任务的拆分规则）
    this.taskPatterns = {
      '创建.*系统': {
        components: ['数据模型', '业务逻辑', 'API接口', '测试用例'],
        estimatedTokens: { base: 3000, perComponent: 800 }
      },
      '实现.*功能': {
        components: ['核心逻辑', '错误处理', '测试验证'],
        estimatedTokens: { base: 2000, perComponent: 600 }
      },
      '优化.*性能': {
        components: ['性能分析', '瓶颈定位', '优化实施', '效果验证'],
        estimatedTokens: { base: 2500, perComponent: 500 }
      },
      '修复.*Bug': {
        components: ['问题复现', '根因分析', '修复实施', '回归测试'],
        estimatedTokens: { base: 1500, perComponent: 400 }
      },
      '编写.*文档': {
        components: ['概述', '详细说明', '示例代码', 'API参考'],
        estimatedTokens: { base: 2000, perComponent: 500 }
      },
      '批量.*': {
        components: [], // 动态生成
        estimatedTokens: { base: 100, perItem: 50 }
      }
    };
    
    // Token估算规则（更精确）
    this.tokenRules = {
      // 关键词基础Token
      keywords: {
        '系统': 500, '模块': 400, '完整': 450, '全部': 400,
        '批量': 200, 'API': 200, '数据库': 300, '测试': 150,
        '文档': 100, '优化': 250, '重构': 400, '迁移': 350,
        '集成': 300, '部署': 200, '配置': 150, '监控': 200
      },
      
      // 动作类型Token
      actions: {
        '创建': 350, '实现': 300, '开发': 350, '构建': 300,
        '修复': 200, '调试': 200, '优化': 250, '重构': 400,
        '测试': 150, '验证': 100, '部署': 200, '配置': 150,
        '编写': 200, '设计': 250, '分析': 200, '评估': 150
      },
      
      // 复杂度乘数
      complexity: {
        '简单': 0.7, '中等': 1.0, '复杂': 1.5, '困难': 2.0,
        '基础': 0.8, '高级': 1.3, '专家级': 1.8
      },
      
      // 文件类型Token
      fileTypes: {
        '.py': 1.2, '.js': 1.0, '.ts': 1.1, '.java': 1.3,
        '.cpp': 1.4, '.go': 1.1, '.rs': 1.2, '.sql': 0.9,
        '.html': 0.8, '.css': 0.7, '.md': 0.6, '.json': 0.5
      }
    };
    
    // 依赖关系关键词
    this.dependencyKeywords = {
      '基于': 'based_on',
      '依赖': 'depends_on',
      '使用': 'uses',
      '在.*之后': 'after',
      '在.*之前': 'before',
      '继承': 'extends',
      '引用': 'references',
      '调用': 'calls'
    };
  }
  
  /**
   * 拆分任务（主入口）
   */
  split(task, context = {}) {
    if (!task || typeof task !== 'string') {
      return { microTasks: [], metadata: { error: 'Invalid task' } };
    }
    
    // 1. 分析任务结构
    const analysis = this.analyzeTask(task, context);
    
    // 2. 估算总Token
    const totalTokens = this.estimateTokens(task, analysis);
    
    // 3. 判断是否需要拆分
    if (totalTokens <= this.config.maxTokensPerTask) {
      return {
        microTasks: [{
          id: 'MICRO-1',
          description: task,
          estimatedTokens: totalTokens,
          components: [task],
          autoContinue: false,
          priority: analysis.priority || 'medium'
        }],
        metadata: {
          totalTokens,
          splitMethod: 'no_split',
          analysis
        }
      };
    }
    
    // 4. 智能拆分
    const components = this.config.enableSmartSplit
      ? this.smartSplit(task, analysis, totalTokens)
      : this.fallbackSplit(task, totalTokens);
    
    // 5. 组装微任务
    const microTasks = this.assembleMicroTasks(components, context);
    
    // 6. 分析依赖关系
    if (this.config.enableDependencyAnalysis) {
      this.analyzeDependencies(microTasks);
    }
    
    // 7. 优先级排序
    if (this.config.enablePrioritySort) {
      this.sortByPriority(microTasks);
    }
    
    this.log('拆分完成', `${task} → ${microTasks.length}个微任务`);
    
    return {
      microTasks,
      metadata: {
        totalTokens,
        splitMethod: this.config.enableSmartSplit ? 'smart' : 'fallback',
        componentCount: components.length,
        analysis
      }
    };
  }
  
  /**
   * 分析任务结构
   */
  analyzeTask(task, context = {}) {
    const analysis = {
      type: 'unknown',
      pattern: null,
      keywords: [],
      actions: [],
      complexity: 'medium',
      fileTypes: [],
      isBatch: false,
      batchSize: 0
    };
    
    // 匹配任务模式
    for (const [pattern, config] of Object.entries(this.taskPatterns)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(task)) {
        analysis.type = pattern;
        analysis.pattern = config;
        break;
      }
    }
    
    // 提取关键词
    for (const [keyword, tokens] of Object.entries(this.tokenRules.keywords)) {
      if (task.includes(keyword)) {
        analysis.keywords.push({ keyword, tokens });
      }
    }
    
    // 提取动作
    for (const [action, tokens] of Object.entries(this.tokenRules.actions)) {
      if (task.includes(action) || task.startsWith(action)) {
        analysis.actions.push({ action, tokens });
      }
    }
    
    // 复杂度判断
    for (const [level, multiplier] of Object.entries(this.tokenRules.complexity)) {
      if (task.includes(level)) {
        analysis.complexity = level;
        break;
      }
    }
    
    // 批量任务检测
    const batchMatch = task.match(/(\d+)\s*个|批量.*(\d+)/);
    if (batchMatch) {
      analysis.isBatch = true;
      analysis.batchSize = parseInt(batchMatch[1] || batchMatch[2]);
    }
    
    // 文件类型检测
    const fileMatch = task.match(/\.(py|js|ts|java|cpp|go|rs|sql|html|css|md|json)/g);
    if (fileMatch) {
      analysis.fileTypes = [...new Set(fileMatch)];
    }
    
    // 优先级推断
    if (task.includes('紧急') || task.includes('立即') || task.includes('马上')) {
      analysis.priority = 'high';
    } else if (task.includes('优化') || task.includes('文档') || task.includes('可选')) {
      analysis.priority = 'low';
    } else {
      analysis.priority = 'medium';
    }
    
    return analysis;
  }
  
  /**
   * Token估算（精确版）
   */
  estimateTokens(task, analysis) {
    let tokens = 0;
    
    // 基础Token（任务描述长度）
    tokens += task.length * 0.3; // 中文约0.3 token/字
    
    // 关键词Token
    analysis.keywords.forEach(k => {
      tokens += k.tokens;
    });
    
    // 动作Token
    if (analysis.actions.length > 0) {
      tokens += analysis.actions[0].tokens; // 只算第一个主要动作
    }
    
    // 复杂度乘数
    const complexityMultiplier = this.tokenRules.complexity[analysis.complexity] || 1.0;
    tokens *= complexityMultiplier;
    
    // 文件类型乘数
    if (analysis.fileTypes.length > 0) {
      const avgMultiplier = analysis.fileTypes.reduce((sum, ft) => 
        sum + (this.tokenRules.fileTypes[ft] || 1.0), 0
      ) / analysis.fileTypes.length;
      tokens *= avgMultiplier;
    }
    
    // 批量任务额外Token
    if (analysis.isBatch && analysis.pattern) {
      const perItem = analysis.pattern.estimatedTokens?.perItem || 50;
      tokens += analysis.batchSize * perItem;
    }
    
    // 模式基础Token
    if (analysis.pattern && analysis.pattern.estimatedTokens) {
      tokens += analysis.pattern.estimatedTokens.base;
    }
    
    // 最小和最大限制
    tokens = Math.max(this.config.minTokensPerTask, Math.min(tokens, 10000));
    
    return Math.round(tokens);
  }
  
  /**
   * 智能拆分
   */
  smartSplit(task, analysis, totalTokens) {
    const components = [];
    
    // 策略1: 使用模式组件
    if (analysis.pattern && analysis.pattern.components.length > 0) {
      const patternComponents = analysis.pattern.components;
      const tokensPerComponent = analysis.pattern.estimatedTokens.perComponent;
      
      patternComponents.forEach((comp, index) => {
        components.push({
          id: `COMP-${index + 1}`,
          description: `${comp}（${task.split(/[，。]/)[0]}）`,
          estimatedTokens: tokensPerComponent,
          order: index + 1,
          type: 'pattern'
        });
      });
      
      return components;
    }
    
    // 策略2: 批量任务拆分
    if (analysis.isBatch && analysis.batchSize > 0) {
      const itemsPerBatch = Math.ceil(
        this.config.maxTokensPerTask / 
        (analysis.pattern?.estimatedTokens?.perItem || 100)
      );
      
      const batchCount = Math.ceil(analysis.batchSize / itemsPerBatch);
      
      for (let i = 0; i < batchCount; i++) {
        const start = i * itemsPerBatch + 1;
        const end = Math.min((i + 1) * itemsPerBatch, analysis.batchSize);
        
        components.push({
          id: `BATCH-${i + 1}`,
          description: `${task}（第${start}-${end}项）`,
          estimatedTokens: (end - start + 1) * (analysis.pattern?.estimatedTokens?.perItem || 100),
          order: i + 1,
          type: 'batch',
          batchRange: { start, end }
        });
      }
      
      return components;
    }
    
    // 策略3: 按句子拆分（回退）
    return this.fallbackSplit(task, totalTokens);
  }
  
  /**
   * 回退拆分（简单按Token平分）
   */
  fallbackSplit(task, totalTokens) {
    const batchCount = Math.ceil(totalTokens / this.config.maxTokensPerTask);
    const tokensPerBatch = Math.ceil(totalTokens / batchCount);
    
    const components = [];
    
    for (let i = 0; i < batchCount; i++) {
      components.push({
        id: `PART-${i + 1}`,
        description: `${task}（第${i + 1}/${batchCount}部分）`,
        estimatedTokens: tokensPerBatch,
        order: i + 1,
        type: 'fallback'
      });
    }
    
    return components;
  }
  
  /**
   * 组装微任务
   */
  assembleMicroTasks(components, context = {}) {
    const microTasks = [];
    let currentBatch = [];
    let currentTokens = 0;
    
    for (const [index, comp] of components.entries()) {
      // 检查是否超过限制
      if (currentTokens + comp.estimatedTokens > this.config.maxTokensPerTask && currentBatch.length > 0) {
        // 创建微任务
        microTasks.push({
          id: `MICRO-${microTasks.length + 1}`,
          description: this.summarizeComponents(currentBatch),
          components: currentBatch.map(c => c.description),
          estimatedTokens: currentTokens,
          autoContinue: true, // 中间批次自动续航
          priority: context.priority || 'medium',
          order: microTasks.length + 1
        });
        
        // 重置
        currentBatch = [];
        currentTokens = 0;
      }
      
      currentBatch.push(comp);
      currentTokens += comp.estimatedTokens;
    }
    
    // 最后一批
    if (currentBatch.length > 0) {
      microTasks.push({
        id: `MICRO-${microTasks.length + 1}`,
        description: this.summarizeComponents(currentBatch),
        components: currentBatch.map(c => c.description),
        estimatedTokens: currentTokens,
        autoContinue: false, // 最后一批不续航
        priority: context.priority || 'medium',
        order: microTasks.length + 1
      });
    }
    
    return microTasks;
  }
  
  /**
   * 总结组件
   */
  summarizeComponents(components) {
    if (components.length === 1) {
      return components[0].description;
    }
    
    // 提取共同前缀
    const firstDesc = components[0].description;
    const prefix = firstDesc.split(/[（(]/)[0];
    
    return `${prefix}（${components.map((c, i) => `${i + 1}.${c.description.split(/[（(]/)[1]?.replace(/[）)]/, '') || c.id}`).join('、')}）`;
  }
  
  /**
   * 分析依赖关系
   */
  analyzeDependencies(microTasks) {
    for (let i = 0; i < microTasks.length; i++) {
      const task = microTasks[i];
      task.dependencies = [];
      
      // 检查依赖关键词
      for (const [keyword, type] of Object.entries(this.dependencyKeywords)) {
        const regex = new RegExp(keyword, 'i');
        
        if (regex.test(task.description)) {
          // 查找依赖的任务
          for (let j = 0; j < i; j++) {
            if (task.description.includes(microTasks[j].description.split('（')[0])) {
              task.dependencies.push({
                taskId: microTasks[j].id,
                type,
                description: microTasks[j].description
              });
            }
          }
        }
      }
      
      // 默认依赖：顺序依赖（非批量任务）
      if (task.dependencies.length === 0 && i > 0 && !task.components.some(c => c.includes('批量'))) {
        task.dependencies.push({
          taskId: microTasks[i - 1].id,
          type: 'sequential',
          description: '按顺序执行'
        });
      }
    }
  }
  
  /**
   * 优先级排序
   */
  sortByPriority(microTasks) {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    
    microTasks.sort((a, b) => {
      // 优先级排序
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // 相同优先级按order排序
      return a.order - b.order;
    });
    
    // 重新分配order
    microTasks.forEach((task, index) => {
      task.order = index + 1;
    });
  }
  
  /**
   * 生成执行计划
   */
  generateExecutionPlan(microTasks) {
    const plan = {
      totalMicroTasks: microTasks.length,
      totalEstimatedTokens: microTasks.reduce((sum, t) => sum + t.estimatedTokens, 0),
      autoContinueBatches: microTasks.filter(t => t.autoContinue).length,
      executionOrder: [],
      timeline: []
    };
    
    // 执行顺序（考虑依赖）
    const executed = new Set();
    const queue = [...microTasks];
    
    while (queue.length > 0) {
      const task = queue.shift();
      
      // 检查依赖是否满足
      const depsReady = task.dependencies.every(dep => executed.has(dep.taskId));
      
      if (depsReady) {
        plan.executionOrder.push({
          order: plan.executionOrder.length + 1,
          taskId: task.id,
          description: task.description,
          estimatedTokens: task.estimatedTokens,
          autoContinue: task.autoContinue
        });
        executed.add(task.id);
      } else {
        // 依赖未满足，放回队列末尾
        queue.push(task);
      }
    }
    
    // 生成时间线
    let accumulatedTime = 0;
    plan.executionOrder.forEach(item => {
      const estimatedTime = Math.ceil(item.estimatedTokens / 10); // 假设10 token/秒
      plan.timeline.push({
        taskId: item.taskId,
        startTime: `T+${accumulatedTime}s`,
        endTime: `T+${accumulatedTime + estimatedTime}s`,
        duration: `${estimatedTime}s`
      });
      accumulatedTime += estimatedTime;
    });
    
    plan.totalEstimatedTime = `${accumulatedTime}s`;
    
    return plan;
  }
  
  /**
   * 日志
   */
  log(level, message) {
    if (!this.config.logEnabled) return;
    console.log(`[微任务拆分] [${level}] ${message}`);
  }
  
  /**
   * 生成可视化（Markdown）
   */
  generateVisualization(microTasks, metadata) {
    let md = '# 微任务拆分可视化\n\n';
    
    md += '## 📊 拆分概览\n\n';
    md += `- **原始任务Token**: ${metadata.totalTokens}\n`;
    md += `- **拆分方法**: ${metadata.splitMethod}\n`;
    md += `- **微任务数量**: ${microTasks.length}\n`;
    md += `- **自动续航批次**: ${microTasks.filter(t => t.autoContinue).length}\n\n`;
    
    md += '## 📋 微任务清单\n\n';
    microTasks.forEach((task, index) => {
      const continueIcon = task.autoContinue ? '⚡' : '🛑';
      const priorityIcon = { high: '🔴', medium: '🟡', low: '🟢' }[task.priority] || '⚪';
      
      md += `### ${index + 1}. ${continueIcon} ${priorityIcon} ${task.description}\n\n`;
      md += `- **ID**: ${task.id}\n`;
      md += `- **Token**: ${task.estimatedTokens}\n`;
      md += `- **优先级**: ${task.priority}\n`;
      md += `- **自动续航**: ${task.autoContinue ? '是' : '否'}\n`;
      
      if (task.dependencies && task.dependencies.length > 0) {
        md += `- **依赖**: ${task.dependencies.map(d => d.taskId).join(', ')}\n`;
      }
      
      if (task.components && task.components.length > 1) {
        md += `- **包含组件**:\n`;
        task.components.forEach(comp => {
          md += `  - ${comp}\n`;
        });
      }
      
      md += '\n';
    });
    
    // 执行计划
    const plan = this.generateExecutionPlan(microTasks);
    md += '## ⏱️ 执行时间线\n\n';
    md += '| 顺序 | 任务ID | 开始时间 | 结束时间 | 持续时间 |\n';
    md += '|------|--------|----------|----------|----------|\n';
    plan.timeline.forEach((item, index) => {
      const order = plan.executionOrder[index];
      md += `| ${order.order} | ${item.taskId} | ${item.startTime} | ${item.endTime} | ${item.duration} |\n`;
    });
    
    md += `\n**预计总时间**: ${plan.totalEstimatedTime}\n`;
    
    return md;
  }
}

module.exports = MicroTaskSplitter;

// CLI测试
if (require.main === module) {
  const splitter = new MicroTaskSplitter();
  
  console.log('\n========== 微任务拆分引擎测试 ==========\n');
  
  const testCases = [
    '创建完整的用户认证系统',
    '批量修改50个配置文件',
    '优化数据库查询性能',
    '修复登录功能Bug',
    '编写API文档',
    '实现复杂的订单处理功能'
  ];
  
  testCases.forEach((task, index) => {
    console.log(`\n--- 测试${index + 1}: ${task} ---\n`);
    
    const result = splitter.split(task);
    
    console.log(`原始Token: ${result.metadata.totalTokens}`);
    console.log(`拆分方法: ${result.metadata.splitMethod}`);
    console.log(`微任务数量: ${result.microTasks.length}\n`);
    
    result.microTasks.forEach((mt, i) => {
      const icon = mt.autoContinue ? '⚡' : '🛑';
      console.log(`  ${i + 1}. ${icon} ${mt.description}`);
      console.log(`     Token: ${mt.estimatedTokens}, 优先级: ${mt.priority}`);
    });
    
    // 可视化
    console.log('\n' + splitter.generateVisualization(result.microTasks, result.metadata));
  });
  
  console.log('\n========== 测试完成 ==========\n');
}


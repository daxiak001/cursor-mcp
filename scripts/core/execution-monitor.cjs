/**
 * 执行率监控系统
 * 
 * 功能：
 * 1. 实时追踪AI行为和规则遵守情况
 * 2. 量化执行率和违规行为
 * 3. 生成详细的执行报告
 * 4. 提供优化建议
 * 
 * 优先级：P1 - 重要改进
 * 预期效果：可量化AI执行质量，提供数据驱动的优化方向
 */

const fs = require('fs');
const path = require('path');

class ExecutionMonitor {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      logEnabled: config.logEnabled !== false,
      logPath: config.logPath || path.join(__dirname, '../../logs/execution-monitor.log'),
      reportPath: config.reportPath || path.join(__dirname, '../../reports/execution'),
      realTimeTracking: config.realTimeTracking !== false,
      violationThreshold: config.violationThreshold || 0.3, // 30%违规率触发警告
      autoRecommendation: config.autoRecommendation !== false
    };
    
    // 监控指标
    this.metrics = {
      // 任务执行指标
      totalTasks: 0,
      completedWithoutStop: 0,
      stoppedForConfirmation: 0,
      autoContinueTriggered: 0,
      
      // 用户干预指标
      userInterventions: 0,
      manualContinue: 0,
      manualCorrection: 0,
      
      // 时间指标
      avgTaskCompletionTime: 0,
      totalExecutionTime: 0,
      
      // 违规指标
      violations: [],
      violationCount: 0,
      violationRate: 0,
      
      // 质量指标
      codeQualityScore: 0,
      testCoverage: 0,
      errorRate: 0,
      
      // 起始时间
      startTime: Date.now()
    };
    
    // 实时追踪数据
    this.liveTracking = {
      currentTask: null,
      currentTaskStartTime: null,
      aiOutputs: [],
      userInputs: [],
      events: []
    };
    
    // 违规类型定义
    this.violationTypes = {
      AI_ASKED_CONFIRMATION: {
        severity: 'high',
        description: 'AI停下来询问用户确认',
        pattern: /是否继续|需要.*继续吗|要不要.*继续|可以吗|需不需要/i
      },
      AI_STOPPED_WITHOUT_SIGNAL: {
        severity: 'high',
        description: 'AI停止但未输出续航信号',
        pattern: null // 通过逻辑检测
      },
      SMALL_DECISION_ASKED: {
        severity: 'medium',
        description: 'AI询问小决策（命名、格式等）',
        pattern: /用.*还是|选择.*还是|命名为|格式是/i
      },
      BATCH_TASK_INTERRUPTED: {
        severity: 'high',
        description: '批量任务中途停止',
        pattern: null
      },
      TOKEN_LIMIT_PASSIVE: {
        severity: 'medium',
        description: '被动达到Token限制（未主动分段）',
        pattern: null
      }
    };
    
    this.ensureDirectories();
  }
  
  /**
   * 确保目录存在
   */
  ensureDirectories() {
    const dirs = [
      path.dirname(this.config.logPath),
      this.config.reportPath
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  /**
   * 开始监控任务
   */
  startTask(taskInfo) {
    if (!this.config.enabled) return;
    
    this.metrics.totalTasks++;
    this.liveTracking.currentTask = {
      id: `TASK-${this.metrics.totalTasks}`,
      description: taskInfo.description || 'Unknown',
      startTime: Date.now(),
      status: 'in_progress',
      ...taskInfo
    };
    this.liveTracking.currentTaskStartTime = Date.now();
    
    this.logEvent('TASK_START', {
      taskId: this.liveTracking.currentTask.id,
      description: taskInfo.description
    });
  }
  
  /**
   * 追踪AI输出
   */
  trackAIOutput(output, metadata = {}) {
    if (!this.config.enabled) return;
    
    const aiOutput = {
      timestamp: Date.now(),
      content: output,
      length: output.length,
      metadata,
      violations: []
    };
    
    // 检测违规行为
    this.detectViolations(output, aiOutput);
    
    // 检测续航信号
    const hasContinueSignal = this.detectContinueSignal(output);
    aiOutput.hasContinueSignal = hasContinueSignal;
    
    // 检测是否完成
    const isCompletion = this.detectCompletion(output);
    aiOutput.isCompletion = isCompletion;
    
    if (isCompletion && aiOutput.violations.length === 0) {
      this.metrics.completedWithoutStop++;
    }
    
    if (aiOutput.violations.length > 0) {
      this.metrics.stoppedForConfirmation++;
      this.metrics.violationCount += aiOutput.violations.length;
    }
    
    this.liveTracking.aiOutputs.push(aiOutput);
    
    this.logEvent('AI_OUTPUT', {
      length: output.length,
      hasContinueSignal,
      isCompletion,
      violationCount: aiOutput.violations.length
    });
    
    return aiOutput;
  }
  
  /**
   * 追踪用户输入
   */
  trackUserInput(input, type = 'unknown') {
    if (!this.config.enabled) return;
    
    const userInput = {
      timestamp: Date.now(),
      content: input,
      type
    };
    
    // 检测干预类型
    if (/^继续/.test(input.trim())) {
      this.metrics.userInterventions++;
      this.metrics.manualContinue++;
      userInput.type = 'manual_continue';
    } else if (input.length > 50) {
      this.metrics.userInterventions++;
      this.metrics.manualCorrection++;
      userInput.type = 'correction';
    }
    
    this.liveTracking.userInputs.push(userInput);
    
    this.logEvent('USER_INPUT', {
      type: userInput.type,
      length: input.length
    });
    
    return userInput;
  }
  
  /**
   * 追踪自动续航触发
   */
  trackAutoContinue(triggered = true, reason = '') {
    if (!this.config.enabled) return;
    
    if (triggered) {
      this.metrics.autoContinueTriggered++;
    }
    
    this.logEvent('AUTO_CONTINUE', {
      triggered,
      reason
    });
  }
  
  /**
   * 完成任务
   */
  completeTask(success = true, metadata = {}) {
    if (!this.config.enabled || !this.liveTracking.currentTask) return;
    
    const task = this.liveTracking.currentTask;
    const duration = Date.now() - this.liveTracking.currentTaskStartTime;
    
    task.endTime = Date.now();
    task.duration = duration;
    task.success = success;
    task.metadata = metadata;
    task.status = success ? 'completed' : 'failed';
    
    // 更新平均完成时间
    this.metrics.totalExecutionTime += duration;
    this.metrics.avgTaskCompletionTime = 
      this.metrics.totalExecutionTime / this.metrics.totalTasks;
    
    this.logEvent('TASK_COMPLETE', {
      taskId: task.id,
      duration,
      success
    });
    
    // 重置当前任务
    this.liveTracking.currentTask = null;
    this.liveTracking.currentTaskStartTime = null;
  }
  
  /**
   * 检测违规行为
   */
  detectViolations(output, aiOutput) {
    for (const [type, config] of Object.entries(this.violationTypes)) {
      if (config.pattern && config.pattern.test(output)) {
        const violation = {
          type,
          severity: config.severity,
          description: config.description,
          timestamp: Date.now(),
          context: output.substring(0, 200)
        };
        
        aiOutput.violations.push(violation);
        this.metrics.violations.push(violation);
        
        this.logViolation(violation);
      }
    }
  }
  
  /**
   * 检测续航信号
   */
  detectContinueSignal(output) {
    const signals = [
      /⚡\s*继续/i,
      /⚡\s*立即(开始|继续)/i,
      /已完成\s*\d+\/\d+.*继续/i,
      /第\d+段完成.*继续第\d+段/i
    ];
    
    return signals.some(s => s.test(output));
  }
  
  /**
   * 检测任务完成
   */
  detectCompletion(output) {
    const completionPatterns = [
      /✅.*完成(?!.*继续)/i,
      /全部.*完成/i,
      /任务.*完成/i,
      /successfully completed/i
    ];
    
    return completionPatterns.some(p => p.test(output));
  }
  
  /**
   * 记录违规
   */
  logViolation(violation) {
    const message = `[违规] ${violation.type} (${violation.severity}): ${violation.description}`;
    this.log('VIOLATION', message);
    
    // 检查是否需要警告
    this.metrics.violationRate = this.metrics.violationCount / this.metrics.totalTasks;
    
    if (this.metrics.violationRate > this.config.violationThreshold) {
      this.log('WARNING', `违规率过高: ${(this.metrics.violationRate * 100).toFixed(1)}%`);
    }
  }
  
  /**
   * 记录事件
   */
  logEvent(type, data) {
    const event = {
      type,
      timestamp: Date.now(),
      data
    };
    
    this.liveTracking.events.push(event);
    
    if (this.config.realTimeTracking) {
      this.log('EVENT', `${type}: ${JSON.stringify(data)}`);
    }
  }
  
  /**
   * 日志记录
   */
  log(level, message) {
    if (!this.config.logEnabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    // 控制台
    const levelColors = {
      'EVENT': '\x1b[36m',
      'VIOLATION': '\x1b[31m',
      'WARNING': '\x1b[33m',
      'INFO': '\x1b[32m'
    };
    const color = levelColors[level] || '\x1b[0m';
    console.log(`${color}[执行监控] ${logMessage}\x1b[0m`);
    
    // 文件
    try {
      fs.appendFileSync(this.config.logPath, logMessage);
    } catch (error) {
      console.error(`写入日志失败: ${error.message}`);
    }
  }
  
  /**
   * 计算执行率
   */
  calculateExecutionRate() {
    if (this.metrics.totalTasks === 0) return 0;
    
    const rate = (this.metrics.completedWithoutStop / this.metrics.totalTasks) * 100;
    return parseFloat(rate.toFixed(1));
  }
  
  /**
   * 计算效率分数
   */
  calculateEfficiencyScore() {
    const executionRate = this.calculateExecutionRate();
    const autoContinueRate = this.metrics.totalTasks > 0
      ? (this.metrics.autoContinueTriggered / this.metrics.totalTasks) * 100
      : 0;
    const interventionPenalty = this.metrics.userInterventions * 5;
    const violationPenalty = this.metrics.violationRate * 50;
    
    const score = Math.max(0, Math.min(100, 
      executionRate * 0.5 + 
      autoContinueRate * 0.3 - 
      interventionPenalty - 
      violationPenalty
    ));
    
    return parseFloat(score.toFixed(1));
  }
  
  /**
   * 生成执行报告
   */
  generateReport() {
    const executionRate = this.calculateExecutionRate();
    const efficiencyScore = this.calculateEfficiencyScore();
    const uptime = Date.now() - this.metrics.startTime;
    
    const report = {
      summary: {
        totalTasks: this.metrics.totalTasks,
        completedWithoutStop: this.metrics.completedWithoutStop,
        stoppedForConfirmation: this.metrics.stoppedForConfirmation,
        autoContinueTriggered: this.metrics.autoContinueTriggered,
        executionRate: `${executionRate}%`,
        efficiencyScore: `${efficiencyScore}/100`
      },
      
      userInteraction: {
        totalInterventions: this.metrics.userInterventions,
        manualContinue: this.metrics.manualContinue,
        manualCorrection: this.metrics.manualCorrection,
        interventionRate: this.metrics.totalTasks > 0
          ? `${((this.metrics.userInterventions / this.metrics.totalTasks) * 100).toFixed(1)}%`
          : '0%'
      },
      
      performance: {
        avgTaskCompletionTime: `${(this.metrics.avgTaskCompletionTime / 1000).toFixed(1)}s`,
        totalExecutionTime: `${(this.metrics.totalExecutionTime / 1000).toFixed(1)}s`,
        uptime: `${(uptime / 1000).toFixed(1)}s`
      },
      
      quality: {
        violationCount: this.metrics.violationCount,
        violationRate: `${(this.metrics.violationRate * 100).toFixed(1)}%`,
        topViolations: this.getTopViolations(5),
        codeQualityScore: this.metrics.codeQualityScore,
        errorRate: this.metrics.errorRate
      },
      
      recommendations: this.config.autoRecommendation 
        ? this.generateRecommendations()
        : [],
      
      timestamp: new Date().toISOString()
    };
    
    return report;
  }
  
  /**
   * 获取最常见违规
   */
  getTopViolations(limit = 5) {
    const violationCounts = {};
    
    this.metrics.violations.forEach(v => {
      violationCounts[v.type] = (violationCounts[v.type] || 0) + 1;
    });
    
    return Object.entries(violationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([type, count]) => ({
        type,
        count,
        description: this.violationTypes[type]?.description || 'Unknown',
        severity: this.violationTypes[type]?.severity || 'unknown'
      }));
  }
  
  /**
   * 生成优化建议
   */
  generateRecommendations() {
    const recommendations = [];
    const executionRate = this.calculateExecutionRate();
    
    // 执行率低
    if (executionRate < 60) {
      recommendations.push({
        priority: 'high',
        category: 'execution_rate',
        issue: `执行率过低 (${executionRate}%)`,
        suggestion: 'AI频繁停下询问，建议：1) 增强自动续航信号检测 2) 优化AI输出规范 3) 启用强制自动续航模式',
        impact: '执行率提升至80%+，减少60%用户干预'
      });
    }
    
    // 违规率高
    if (this.metrics.violationRate > 0.3) {
      const topViolation = this.getTopViolations(1)[0];
      recommendations.push({
        priority: 'high',
        category: 'violations',
        issue: `违规率过高 (${(this.metrics.violationRate * 100).toFixed(1)}%)`,
        suggestion: `最常见违规: ${topViolation?.description}。建议加强对应规则的执行检查`,
        impact: '违规率降低50%，提升系统稳定性'
      });
    }
    
    // 用户干预多
    if (this.metrics.userInterventions > this.metrics.totalTasks * 0.5) {
      recommendations.push({
        priority: 'medium',
        category: 'user_intervention',
        issue: `用户干预频繁 (${this.metrics.userInterventions}次/${this.metrics.totalTasks}任务)`,
        suggestion: '1) 启用自动续航 2) 优化TODO解析 3) 使用微任务自动拆分',
        impact: '用户干预减少80%，开发效率提升3倍'
      });
    }
    
    // 自动续航未启用或效果差
    if (this.metrics.autoContinueTriggered < this.metrics.totalTasks * 0.3) {
      recommendations.push({
        priority: 'high',
        category: 'auto_continue',
        issue: `自动续航触发率低 (${this.metrics.autoContinueTriggered}/${this.metrics.totalTasks})`,
        suggestion: 'AI输出缺少续航信号，建议：1) 规范AI输出格式（使用⚡继续） 2) 降低续航信号检测阈值',
        impact: '自动续航率提升至90%+，实现真正自动化'
      });
    }
    
    // 任务完成时间过长
    if (this.metrics.avgTaskCompletionTime > 300000) { // 5分钟
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        issue: `平均任务耗时过长 (${(this.metrics.avgTaskCompletionTime / 1000).toFixed(0)}s)`,
        suggestion: '1) 启用微任务拆分 2) 优化Token估算 3) 使用并行执行',
        impact: '任务耗时减少50%，开发速度翻倍'
      });
    }
    
    // 效率分数低
    const efficiencyScore = this.calculateEfficiencyScore();
    if (efficiencyScore < 60) {
      recommendations.push({
        priority: 'high',
        category: 'overall',
        issue: `整体效率分数低 (${efficiencyScore}/100)`,
        suggestion: '综合优化：1) 实施P0修复方案 2) 启用所有自动化功能 3) 优化AI输出规范',
        impact: '效率分数提升至90+，达到生产级别'
      });
    }
    
    return recommendations;
  }
  
  /**
   * 保存报告到文件
   */
  saveReport() {
    const report = this.generateReport();
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const filename = `execution-report-${timestamp}.json`;
    const filepath = path.join(this.config.reportPath, filename);
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8');
      this.log('INFO', `报告已保存: ${filepath}`);
      return filepath;
    } catch (error) {
      this.log('WARNING', `保存报告失败: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 生成Markdown报告
   */
  generateMarkdownReport() {
    const report = this.generateReport();
    const executionRate = report.summary.executionRate;
    const efficiencyScore = report.summary.efficiencyScore;
    
    let md = '# 执行率监控报告\n\n';
    md += `**生成时间:** ${report.timestamp}\n\n`;
    md += '---\n\n';
    
    // 总览
    md += '## 📊 执行总览\n\n';
    md += '| 指标 | 数值 | 评价 |\n';
    md += '|------|------|------|\n';
    md += `| 总任务数 | ${report.summary.totalTasks} | - |\n`;
    md += `| 无中断完成 | ${report.summary.completedWithoutStop} | ${this.getRatingIcon(report.summary.completedWithoutStop / report.summary.totalTasks)} |\n`;
    md += `| 停下询问 | ${report.summary.stoppedForConfirmation} | ${this.getRatingIcon(1 - report.summary.stoppedForConfirmation / report.summary.totalTasks)} |\n`;
    md += `| 自动续航触发 | ${report.summary.autoContinueTriggered} | ${this.getRatingIcon(report.summary.autoContinueTriggered / report.summary.totalTasks)} |\n`;
    md += `| **执行率** | **${executionRate}** | **${this.getRatingIcon(parseFloat(executionRate) / 100)}** |\n`;
    md += `| **效率分数** | **${efficiencyScore}** | **${this.getRatingIcon(parseFloat(efficiencyScore) / 100)}** |\n\n`;
    
    // 用户交互
    md += '## 👤 用户交互分析\n\n';
    md += `- 总干预次数: ${report.userInteraction.totalInterventions}\n`;
    md += `- 手动"继续": ${report.userInteraction.manualContinue}\n`;
    md += `- 手动纠正: ${report.userInteraction.manualCorrection}\n`;
    md += `- 干预率: ${report.userInteraction.interventionRate}\n\n`;
    
    // 性能指标
    md += '## ⚡ 性能指标\n\n';
    md += `- 平均任务耗时: ${report.performance.avgTaskCompletionTime}\n`;
    md += `- 总执行时间: ${report.performance.totalExecutionTime}\n`;
    md += `- 系统运行时间: ${report.performance.uptime}\n\n`;
    
    // 质量分析
    md += '## 🎯 质量分析\n\n';
    md += `- 违规总数: ${report.quality.violationCount}\n`;
    md += `- 违规率: ${report.quality.violationRate}\n\n`;
    
    if (report.quality.topViolations.length > 0) {
      md += '### 最常见违规\n\n';
      md += '| 类型 | 次数 | 严重程度 | 描述 |\n';
      md += '|------|------|----------|------|\n';
      report.quality.topViolations.forEach(v => {
        md += `| ${v.type} | ${v.count} | ${v.severity} | ${v.description} |\n`;
      });
      md += '\n';
    }
    
    // 优化建议
    if (report.recommendations.length > 0) {
      md += '## 💡 优化建议\n\n';
      report.recommendations.forEach((rec, index) => {
        const priorityIcon = { high: '🔴', medium: '🟡', low: '🟢' }[rec.priority] || '⚪';
        md += `### ${index + 1}. ${priorityIcon} ${rec.issue}\n\n`;
        md += `**类别:** ${rec.category}\n\n`;
        md += `**建议:** ${rec.suggestion}\n\n`;
        md += `**预期效果:** ${rec.impact}\n\n`;
      });
    }
    
    md += '---\n\n';
    md += '*报告由执行率监控系统自动生成*\n';
    
    return md;
  }
  
  /**
   * 获取评价图标
   */
  getRatingIcon(ratio) {
    if (ratio >= 0.9) return '⭐⭐⭐⭐⭐';
    if (ratio >= 0.75) return '⭐⭐⭐⭐';
    if (ratio >= 0.6) return '⭐⭐⭐';
    if (ratio >= 0.4) return '⭐⭐';
    return '⭐';
  }
  
  /**
   * 保存Markdown报告
   */
  saveMarkdownReport() {
    const md = this.generateMarkdownReport();
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const filename = `execution-report-${timestamp}.md`;
    const filepath = path.join(this.config.reportPath, filename);
    
    try {
      fs.writeFileSync(filepath, md, 'utf8');
      this.log('INFO', `Markdown报告已保存: ${filepath}`);
      return filepath;
    } catch (error) {
      this.log('WARNING', `保存Markdown报告失败: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 重置统计数据
   */
  reset() {
    this.metrics = {
      totalTasks: 0,
      completedWithoutStop: 0,
      stoppedForConfirmation: 0,
      autoContinueTriggered: 0,
      userInterventions: 0,
      manualContinue: 0,
      manualCorrection: 0,
      avgTaskCompletionTime: 0,
      totalExecutionTime: 0,
      violations: [],
      violationCount: 0,
      violationRate: 0,
      codeQualityScore: 0,
      testCoverage: 0,
      errorRate: 0,
      startTime: Date.now()
    };
    
    this.liveTracking = {
      currentTask: null,
      currentTaskStartTime: null,
      aiOutputs: [],
      userInputs: [],
      events: []
    };
    
    this.log('INFO', '监控数据已重置');
  }
}

module.exports = ExecutionMonitor;

// CLI测试
if (require.main === module) {
  const monitor = new ExecutionMonitor();
  
  console.log('\n========== 执行率监控系统测试 ==========\n');
  
  // 模拟场景
  monitor.startTask({ description: '创建User模型' });
  monitor.trackAIOutput('✅ User模型完成\n⚡ 继续下一个任务...');
  monitor.trackAutoContinue(true, '检测到续航信号');
  monitor.completeTask(true);
  
  monitor.startTask({ description: '创建Product模型' });
  monitor.trackAIOutput('Product模型创建完成。是否继续？'); // 违规
  monitor.trackUserInput('继续', 'manual_continue');
  monitor.completeTask(true);
  
  monitor.startTask({ description: '实现API接口' });
  monitor.trackAIOutput('✅ API接口完成\n⚡ 立即开始测试...');
  monitor.trackAutoContinue(true);
  monitor.completeTask(true);
  
  // 生成报告
  console.log('=== JSON报告 ===\n');
  const jsonReport = monitor.generateReport();
  console.log(JSON.stringify(jsonReport, null, 2));
  
  console.log('\n=== Markdown报告 ===\n');
  const mdReport = monitor.generateMarkdownReport();
  console.log(mdReport);
  
  // 保存报告
  monitor.saveReport();
  monitor.saveMarkdownReport();
  
  console.log('\n========== 测试完成 ==========\n');
}


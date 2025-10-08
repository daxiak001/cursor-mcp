/**
 * 监管数据分析脚本
 * 功能：分析monitor.log，生成统计报告和异常检测
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/monitor.log');
const REPORT_DIR = path.join(__dirname, '../reports');

/**
 * 读取并解析监管日志
 */
function readMonitorLogs(daysAgo = 7) {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('⚠️  监管日志文件不存在，请先运行系统以生成日志');
    return [];
  }

  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const cutoffTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  
  const events = lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(event => {
      if (!event) return false;
      const eventDate = new Date(event.timestamp);
      return eventDate > cutoffTime;
    });
  
  return events;
}

/**
 * 分析监管数据
 */
function analyzeMonitorData(daysAgo = 7) {
  const events = readMonitorLogs(daysAgo);
  
  if (events.length === 0) {
    return {
      totalEvents: 0,
      byType: {},
      bySeverity: {},
      ruleStats: {},
      performance: {},
      timeline: []
    };
  }
  
  const stats = {
    totalEvents: events.length,
    byType: {},
    bySeverity: {},
    ruleStats: {},
    performance: {
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      p95ResponseTime: 0,
      totalApiCalls: 0
    },
    blockingStats: {
      totalChecks: 0,
      totalBlocks: 0,
      totalPasses: 0,
      blockRate: 0
    },
    timeline: []
  };
  
  // 按类型统计
  events.forEach(event => {
    stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
    stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
  });
  
  // 规则检查统计
  const ruleCheckEvents = events.filter(e => e.type === 'rule_check');
  ruleCheckEvents.forEach(event => {
    if (!stats.ruleStats[event.ruleId]) {
      stats.ruleStats[event.ruleId] = {
        triggers: 0,
        blocks: 0,
        passes: 0,
        avgDuration: 0,
        totalDuration: 0
      };
    }
    
    const rule = stats.ruleStats[event.ruleId];
    rule.triggers++;
    rule.totalDuration += event.duration || 0;
    
    if (event.result === 'block' || event.violationCount > 0) {
      rule.blocks++;
      stats.blockingStats.totalBlocks++;
    } else {
      rule.passes++;
      stats.blockingStats.totalPasses++;
    }
    
    stats.blockingStats.totalChecks++;
  });
  
  // 计算规则平均时长
  Object.keys(stats.ruleStats).forEach(ruleId => {
    const rule = stats.ruleStats[ruleId];
    rule.avgDuration = rule.triggers > 0 ? (rule.totalDuration / rule.triggers).toFixed(2) : 0;
    rule.blockRate = rule.triggers > 0 ? ((rule.blocks / rule.triggers) * 100).toFixed(1) : 0;
  });
  
  // 计算总体拦截率
  if (stats.blockingStats.totalChecks > 0) {
    stats.blockingStats.blockRate = (
      (stats.blockingStats.totalBlocks / stats.blockingStats.totalChecks) * 100
    ).toFixed(2);
  }
  
  // API性能统计
  const apiEvents = events.filter(e => e.type === 'api_call' && e.duration);
  if (apiEvents.length > 0) {
    const durations = apiEvents.map(e => e.duration).sort((a, b) => a - b);
    stats.performance.totalApiCalls = apiEvents.length;
    stats.performance.avgResponseTime = (
      durations.reduce((sum, d) => sum + d, 0) / durations.length
    ).toFixed(2);
    stats.performance.maxResponseTime = durations[durations.length - 1];
    stats.performance.minResponseTime = durations[0];
    stats.performance.p95ResponseTime = durations[Math.floor(durations.length * 0.95)];
  }
  
  // 时间线统计（按小时分组）
  const hourlyStats = {};
  events.forEach(event => {
    const hour = new Date(event.timestamp).toISOString().slice(0, 13);
    if (!hourlyStats[hour]) {
      hourlyStats[hour] = { total: 0, errors: 0, warnings: 0 };
    }
    hourlyStats[hour].total++;
    if (event.severity === 'error') hourlyStats[hour].errors++;
    if (event.severity === 'warning') hourlyStats[hour].warnings++;
  });
  
  stats.timeline = Object.entries(hourlyStats)
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
  
  return stats;
}

/**
 * 检测异常
 */
function detectAnomalies(stats) {
  const alerts = [];
  
  // 检查错误率
  const errorCount = stats.bySeverity.error || 0;
  const errorRate = stats.totalEvents > 0 ? (errorCount / stats.totalEvents * 100).toFixed(1) : 0;
  
  if (errorCount > 10) {
    alerts.push({
      level: 'error',
      category: '错误频率',
      message: `错误事件过多: ${errorCount}次 (${errorRate}%)`,
      suggestion: '检查系统日志，定位错误源'
    });
  }
  
  // 检查响应时间
  if (stats.performance.avgResponseTime > 1000) {
    alerts.push({
      level: 'warning',
      category: '性能问题',
      message: `平均响应时间过长: ${stats.performance.avgResponseTime}ms`,
      suggestion: '优化规则引擎性能或增加缓存'
    });
  }
  
  if (stats.performance.p95ResponseTime > 2000) {
    alerts.push({
      level: 'warning',
      category: '性能问题',
      message: `P95响应时间过长: ${stats.performance.p95ResponseTime}ms`,
      suggestion: '存在性能瓶颈，需要深入分析'
    });
  }
  
  // 检查拦截率
  const blockRate = parseFloat(stats.blockingStats.blockRate);
  if (blockRate < 5 && stats.blockingStats.totalChecks > 100) {
    alerts.push({
      level: 'info',
      category: '规则效果',
      message: `拦截率较低: ${blockRate}%`,
      suggestion: '规则可能过于宽松，或代码质量很好'
    });
  }
  
  if (blockRate > 50) {
    alerts.push({
      level: 'warning',
      category: '规则效果',
      message: `拦截率过高: ${blockRate}%`,
      suggestion: '规则可能过于严格，影响开发效率'
    });
  }
  
  // 检查单个规则异常
  Object.entries(stats.ruleStats).forEach(([ruleId, data]) => {
    const ruleBlockRate = parseFloat(data.blockRate);
    
    if (ruleBlockRate > 80 && data.triggers > 10) {
      alerts.push({
        level: 'warning',
        category: '规则优化',
        message: `规则 ${ruleId} 拦截率过高: ${ruleBlockRate}% (${data.blocks}/${data.triggers})`,
        suggestion: '检查规则是否过于严格或开发者培训'
      });
    }
    
    if (data.avgDuration > 500) {
      alerts.push({
        level: 'warning',
        category: '性能优化',
        message: `规则 ${ruleId} 执行耗时过长: ${data.avgDuration}ms`,
        suggestion: '优化规则检测逻辑'
      });
    }
  });
  
  // 检查健康状态
  const healthEvents = stats.byType.health_check || 0;
  const unhealthyEvents = stats.timeline.filter(t => t.errors > 0).length;
  
  if (unhealthyEvents > healthEvents * 0.1 && healthEvents > 0) {
    alerts.push({
      level: 'error',
      category: '系统健康',
      message: `健康检查失败率过高: ${(unhealthyEvents/healthEvents*100).toFixed(1)}%`,
      suggestion: '检查系统配置和依赖服务'
    });
  }
  
  return alerts;
}

/**
 * 生成Markdown报告
 */
function generateMarkdownReport(stats, alerts, daysAgo = 7) {
  const reportDate = new Date().toISOString().split('T')[0];
  const reportTime = new Date().toISOString().split('T')[1].split('.')[0];
  
  let report = `# 监管系统报告\n\n`;
  report += `**生成时间：** ${reportDate} ${reportTime}  \n`;
  report += `**统计周期：** 最近${daysAgo}天  \n`;
  report += `**数据来源：** logs/monitor.log  \n\n`;
  
  report += `---\n\n`;
  
  // 1. 总体概览
  report += `## 📊 总体概览\n\n`;
  report += `| 指标 | 数值 |\n`;
  report += `|------|------|\n`;
  report += `| 总事件数 | ${stats.totalEvents} |\n`;
  report += `| 规则检查 | ${stats.byType.rule_check || 0} |\n`;
  report += `| Git Hook | ${stats.byType.git_hook || 0} |\n`;
  report += `| API调用 | ${stats.byType.api_call || 0} |\n`;
  report += `| 健康检查 | ${stats.byType.health_check || 0} |\n`;
  report += `| 错误事件 | ${stats.bySeverity.error || 0} |\n`;
  report += `| 警告事件 | ${stats.bySeverity.warning || 0} |\n\n`;
  
  // 2. 拦截统计
  report += `## 🎯 拦截统计\n\n`;
  report += `| 指标 | 数值 |\n`;
  report += `|------|------|\n`;
  report += `| 总检查次数 | ${stats.blockingStats.totalChecks} |\n`;
  report += `| 拦截次数 | ${stats.blockingStats.totalBlocks} |\n`;
  report += `| 通过次数 | ${stats.blockingStats.totalPasses} |\n`;
  report += `| 拦截率 | ${stats.blockingStats.blockRate}% |\n\n`;
  
  const blockRateNum = parseFloat(stats.blockingStats.blockRate);
  if (blockRateNum < 10) {
    report += `✅ **状态：** 优秀，拦截率低说明代码质量好或规则合理。\n\n`;
  } else if (blockRateNum < 30) {
    report += `⚠️  **状态：** 正常，拦截率适中，需要持续关注。\n\n`;
  } else {
    report += `🔴 **状态：** 需要改进，拦截率过高可能影响开发效率。\n\n`;
  }
  
  // 3. 规则效果排名
  report += `## 📋 规则效果排名\n\n`;
  report += `### Top 10 活跃规则\n\n`;
  report += `| 排名 | 规则ID | 触发次数 | 拦截次数 | 拦截率 | 平均耗时 |\n`;
  report += `|------|--------|---------|---------|--------|----------|\n`;
  
  const topRules = Object.entries(stats.ruleStats)
    .sort((a, b) => b[1].triggers - a[1].triggers)
    .slice(0, 10);
  
  topRules.forEach(([ruleId, data], index) => {
    report += `| ${index + 1} | ${ruleId} | ${data.triggers} | ${data.blocks} | ${data.blockRate}% | ${data.avgDuration}ms |\n`;
  });
  
  report += `\n`;
  
  // 4. 性能指标
  report += `## ⚡ 性能指标\n\n`;
  report += `| 指标 | 数值 |\n`;
  report += `|------|------|\n`;
  report += `| API调用总数 | ${stats.performance.totalApiCalls} |\n`;
  report += `| 平均响应时间 | ${stats.performance.avgResponseTime}ms |\n`;
  report += `| 最快响应 | ${stats.performance.minResponseTime}ms |\n`;
  report += `| 最慢响应 | ${stats.performance.maxResponseTime}ms |\n`;
  report += `| P95响应时间 | ${stats.performance.p95ResponseTime}ms |\n\n`;
  
  const avgTime = parseFloat(stats.performance.avgResponseTime);
  if (avgTime < 300) {
    report += `✅ **评价：** 响应时间优秀！\n\n`;
  } else if (avgTime < 1000) {
    report += `⚠️  **评价：** 响应时间良好，可以接受。\n\n`;
  } else {
    report += `🔴 **评价：** 响应时间过长，需要优化！\n\n`;
  }
  
  // 5. 异常检测
  report += `## 🔍 异常检测\n\n`;
  
  if (alerts.length === 0) {
    report += `✅ **未发现异常，系统运行正常！**\n\n`;
  } else {
    report += `⚠️  **发现 ${alerts.length} 个需要关注的问题：**\n\n`;
    
    const errorAlerts = alerts.filter(a => a.level === 'error');
    const warningAlerts = alerts.filter(a => a.level === 'warning');
    const infoAlerts = alerts.filter(a => a.level === 'info');
    
    if (errorAlerts.length > 0) {
      report += `### 🔴 严重问题 (${errorAlerts.length})\n\n`;
      errorAlerts.forEach((alert, i) => {
        report += `**${i + 1}. ${alert.category}**\n`;
        report += `- 问题：${alert.message}\n`;
        report += `- 建议：${alert.suggestion}\n\n`;
      });
    }
    
    if (warningAlerts.length > 0) {
      report += `### ⚠️  警告 (${warningAlerts.length})\n\n`;
      warningAlerts.forEach((alert, i) => {
        report += `**${i + 1}. ${alert.category}**\n`;
        report += `- 问题：${alert.message}\n`;
        report += `- 建议：${alert.suggestion}\n\n`;
      });
    }
    
    if (infoAlerts.length > 0) {
      report += `### ℹ️  提示 (${infoAlerts.length})\n\n`;
      infoAlerts.forEach((alert, i) => {
        report += `**${i + 1}. ${alert.category}**\n`;
        report += `- 信息：${alert.message}\n`;
        report += `- 建议：${alert.suggestion}\n\n`;
      });
    }
  }
  
  // 6. 时间线趋势
  report += `## 📈 时间线趋势（按小时）\n\n`;
  
  if (stats.timeline.length > 0) {
    report += `| 时间 | 总事件 | 错误 | 警告 |\n`;
    report += `|------|--------|------|------|\n`;
    
    stats.timeline.slice(-24).forEach(t => {
      const time = t.hour.split('T')[1] || t.hour;
      report += `| ${time}:00 | ${t.total} | ${t.errors} | ${t.warnings} |\n`;
    });
    report += `\n`;
  } else {
    report += `暂无数据\n\n`;
  }
  
  // 7. 优化建议
  report += `## 💡 优化建议\n\n`;
  
  const suggestions = [];
  
  // 基于数据生成建议
  if (topRules.length > 0 && topRules[0][1].blockRate > 50) {
    suggestions.push(`1. 规则 **${topRules[0][0]}** 拦截率高达 ${topRules[0][1].blockRate}%，建议加强开发者培训或调整规则严格程度。`);
  }
  
  if (avgTime > 500) {
    suggestions.push(`2. 平均响应时间 ${avgTime}ms 超过500ms，建议优化规则引擎性能或添加缓存机制。`);
  }
  
  if (blockRateNum > 40) {
    suggestions.push(`3. 总体拦截率 ${blockRateNum}% 较高，考虑调整部分规则的严格程度以提高开发效率。`);
  } else if (blockRateNum < 5 && stats.blockingStats.totalChecks > 100) {
    suggestions.push(`3. 总体拦截率 ${blockRateNum}% 较低，可以考虑增加更多质量规则。`);
  }
  
  if (stats.bySeverity.error > 5) {
    suggestions.push(`4. 发现 ${stats.bySeverity.error} 个错误事件，建议查看日志并修复问题。`);
  }
  
  if (suggestions.length === 0) {
    report += `✅ 系统运行良好，暂无需要优化的地方。持续保持！\n\n`;
  } else {
    suggestions.forEach(s => {
      report += `${s}\n`;
    });
    report += `\n`;
  }
  
  // 8. 总结
  report += `---\n\n`;
  report += `## 📝 总结\n\n`;
  
  let overallStatus = '✅ 优秀';
  if (alerts.filter(a => a.level === 'error').length > 0) {
    overallStatus = '🔴 需要改进';
  } else if (alerts.filter(a => a.level === 'warning').length > 2) {
    overallStatus = '⚠️  良好';
  }
  
  report += `**系统状态：** ${overallStatus}  \n`;
  report += `**事件总数：** ${stats.totalEvents}  \n`;
  report += `**拦截率：** ${stats.blockingStats.blockRate}%  \n`;
  report += `**平均响应：** ${stats.performance.avgResponseTime}ms  \n`;
  report += `**异常数：** ${alerts.filter(a => a.level !== 'info').length}  \n\n`;
  
  report += `**建议：** `;
  if (overallStatus.includes('优秀')) {
    report += `系统运行优秀，继续保持！\n`;
  } else if (overallStatus.includes('良好')) {
    report += `系统运行良好，关注上述警告并持续优化。\n`;
  } else {
    report += `系统存在问题，请尽快处理上述严重问题。\n`;
  }
  
  return report;
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const daysAgo = parseInt(args[0]) || 7;
  
  console.log(`\n📊 开始分析监管数据（最近${daysAgo}天）...\n`);
  
  // 分析数据
  const stats = analyzeMonitorData(daysAgo);
  
  if (stats.totalEvents === 0) {
    console.log('⚠️  没有找到监管数据，请先运行系统。\n');
    return;
  }
  
  // 检测异常
  const alerts = detectAnomalies(stats);
  
  // 生成报告
  const report = generateMarkdownReport(stats, alerts, daysAgo);
  
  // 保存报告
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  
  const reportDate = new Date().toISOString().split('T')[0];
  const reportPath = path.join(REPORT_DIR, `monitor-report-${reportDate}.md`);
  
  fs.writeFileSync(reportPath, report, 'utf8');
  
  console.log(`✅ 报告已生成: ${reportPath}\n`);
  console.log(`📊 数据摘要:`);
  console.log(`  - 总事件: ${stats.totalEvents}`);
  console.log(`  - 拦截率: ${stats.blockingStats.blockRate}%`);
  console.log(`  - 平均响应: ${stats.performance.avgResponseTime}ms`);
  console.log(`  - 异常数: ${alerts.filter(a => a.level !== 'info').length}\n`);
  
  if (alerts.length > 0) {
    console.log(`⚠️  发现 ${alerts.length} 个需要关注的问题，请查看报告详情。\n`);
  } else {
    console.log(`✅ 系统运行正常，未发现异常！\n`);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  readMonitorLogs,
  analyzeMonitorData,
  detectAnomalies,
  generateMarkdownReport
};


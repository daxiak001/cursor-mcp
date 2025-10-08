/**
 * 监管系统 Dashboard
 * 在终端显示实时监控数据
 */

const { analyzeMonitorData, detectAnomalies } = require('./analyze-monitor.cjs');
const { getLogStats } = require('./monitor-logger.cjs');

/**
 * 显示Dashboard
 */
function displayDashboard(daysAgo = 7) {
  console.clear();
  
  const stats = analyzeMonitorData(daysAgo);
  const alerts = detectAnomalies(stats);
  const recentStats = getLogStats(24);
  
  // 标题
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          📊 监管系统 Dashboard                            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  console.log(`📅 统计周期：最近${daysAgo}天 | 🕐 更新时间：${new Date().toLocaleString('zh-CN')}\n`);
  
  // 1. 系统概览
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 系统概览\n');
  
  console.log(`  事件总数: ${stats.totalEvents.toLocaleString()}`);
  console.log(`  规则检查: ${(stats.byType.rule_check || 0).toLocaleString()}`);
  console.log(`  Git Hook: ${(stats.byType.git_hook || 0).toLocaleString()}`);
  console.log(`  API调用: ${(stats.byType.api_call || 0).toLocaleString()}`);
  console.log(`  健康检查: ${(stats.byType.health_check || 0).toLocaleString()}`);
  console.log(`  错误数: ${(stats.bySeverity.error || 0).toLocaleString()}\n`);
  
  // 2. 执行效率
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 执行效率\n');
  
  const blockRate = parseFloat(stats.blockingStats.blockRate);
  const blockRateBar = getProgressBar(blockRate, 100);
  let blockRateStatus = '✅';
  if (blockRate > 40) blockRateStatus = '🔴';
  else if (blockRate > 20) blockRateStatus = '⚠️';
  
  console.log(`  拦截率: ${blockRateStatus} ${blockRateBar} ${stats.blockingStats.blockRate}%`);
  console.log(`    - 总检查: ${stats.blockingStats.totalChecks.toLocaleString()}`);
  console.log(`    - 拦截: ${stats.blockingStats.totalBlocks.toLocaleString()}`);
  console.log(`    - 通过: ${stats.blockingStats.totalPasses.toLocaleString()}\n`);
  
  // 3. 性能指标
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚡ 性能指标\n');
  
  const avgTime = parseFloat(stats.performance.avgResponseTime);
  const avgTimeBar = getProgressBar(Math.min(avgTime / 10, 100), 100);
  let avgTimeStatus = '✅';
  if (avgTime > 1000) avgTimeStatus = '🔴';
  else if (avgTime > 500) avgTimeStatus = '⚠️';
  
  console.log(`  平均响应: ${avgTimeStatus} ${avgTimeBar} ${stats.performance.avgResponseTime}ms`);
  console.log(`  最快响应: ${stats.performance.minResponseTime === Infinity ? 'N/A' : stats.performance.minResponseTime + 'ms'}`);
  console.log(`  最慢响应: ${stats.performance.maxResponseTime}ms`);
  console.log(`  P95响应: ${stats.performance.p95ResponseTime}ms`);
  console.log(`  API调用: ${stats.performance.totalApiCalls.toLocaleString()}\n`);
  
  // 4. Top 5 活跃规则
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Top 5 活跃规则\n');
  
  const topRules = Object.entries(stats.ruleStats)
    .sort((a, b) => b[1].triggers - a[1].triggers)
    .slice(0, 5);
  
  if (topRules.length > 0) {
    topRules.forEach(([ruleId, data], i) => {
      const ruleBlockRate = parseFloat(data.blockRate);
      const bar = getProgressBar(ruleBlockRate, 100);
      let icon = '✅';
      if (ruleBlockRate > 80) icon = '🔴';
      else if (ruleBlockRate > 50) icon = '⚠️';
      
      console.log(`  ${i + 1}. ${icon} ${ruleId.padEnd(12)} ${bar} ${data.blockRate}%`);
      console.log(`     触发:${data.triggers} | 拦截:${data.blocks} | 耗时:${data.avgDuration}ms\n`);
    });
  } else {
    console.log('  暂无数据\n');
  }
  
  // 5. 最近24小时
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 最近24小时\n');
  
  console.log(`  事件总数: ${recentStats.total.toLocaleString()}`);
  
  if (recentStats.byType && Object.keys(recentStats.byType).length > 0) {
    Object.entries(recentStats.byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}`);
      });
  }
  console.log('');
  
  // 6. 异常检测
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 异常检测\n');
  
  if (alerts.length === 0) {
    console.log('  ✅ 系统运行正常，未发现异常！\n');
  } else {
    const errorAlerts = alerts.filter(a => a.level === 'error');
    const warningAlerts = alerts.filter(a => a.level === 'warning');
    const infoAlerts = alerts.filter(a => a.level === 'info');
    
    if (errorAlerts.length > 0) {
      console.log(`  🔴 严重问题 (${errorAlerts.length}):`);
      errorAlerts.slice(0, 3).forEach(alert => {
        console.log(`     - ${alert.message}`);
      });
      console.log('');
    }
    
    if (warningAlerts.length > 0) {
      console.log(`  ⚠️  警告 (${warningAlerts.length}):`);
      warningAlerts.slice(0, 3).forEach(alert => {
        console.log(`     - ${alert.message}`);
      });
      console.log('');
    }
    
    if (infoAlerts.length > 0) {
      console.log(`  ℹ️  提示 (${infoAlerts.length}):`);
      infoAlerts.slice(0, 2).forEach(alert => {
        console.log(`     - ${alert.message}`);
      });
      console.log('');
    }
  }
  
  // 7. 系统状态
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚦 系统状态\n');
  
  let overallStatus = { icon: '✅', text: '优秀', color: 'green' };
  if (alerts.filter(a => a.level === 'error').length > 0) {
    overallStatus = { icon: '🔴', text: '需要改进', color: 'red' };
  } else if (alerts.filter(a => a.level === 'warning').length > 2) {
    overallStatus = { icon: '⚠️', text: '良好', color: 'yellow' };
  }
  
  console.log(`  状态: ${overallStatus.icon} ${overallStatus.text}`);
  console.log(`  拦截率: ${blockRate}% ${blockRate < 20 ? '(良好)' : blockRate < 40 ? '(正常)' : '(偏高)'}`);
  console.log(`  响应时间: ${avgTime}ms ${avgTime < 500 ? '(优秀)' : avgTime < 1000 ? '(良好)' : '(需优化)'}`);
  console.log(`  异常数: ${alerts.filter(a => a.level !== 'info').length}\n`);
  
  // 8. 操作提示
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 操作提示\n');
  console.log('  - 生成报告: npm run monitor:report');
  console.log('  - 检查异常: npm run monitor:alert');
  console.log('  - 刷新Dashboard: npm run monitor:dashboard\n');
  
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

/**
 * 生成进度条
 */
function getProgressBar(value, max, length = 20) {
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  
  let bar = '[';
  bar += '█'.repeat(filled);
  bar += '░'.repeat(empty);
  bar += ']';
  
  return bar;
}

/**
 * 实时监控模式
 */
function startLiveMonitor(intervalSeconds = 5) {
  console.log(`\n🔄 启动实时监控 (每${intervalSeconds}秒刷新)\n`);
  console.log('按 Ctrl+C 退出\n');
  
  displayDashboard();
  
  setInterval(() => {
    displayDashboard();
  }, intervalSeconds * 1000);
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'show';
  
  switch (command) {
    case 'show':
      displayDashboard(7);
      break;
    case 'live':
      const interval = parseInt(args[1]) || 5;
      startLiveMonitor(interval);
      break;
    default:
      console.log('\n用法:');
      console.log('  node scripts/dashboard.cjs show        # 显示Dashboard');
      console.log('  node scripts/dashboard.cjs live [秒]   # 实时监控模式\n');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  displayDashboard,
  startLiveMonitor
};


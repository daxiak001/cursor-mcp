/**
 * 监管日志系统
 * 用于记录系统各模块的执行情况、异常和违规
 */

const fs = require('fs');
const path = require('path');

// 日志目录
const LOG_DIR = path.join(__dirname, '../logs');
const MONITOR_LOG = path.join(LOG_DIR, 'monitor.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 事件类型
const EventTypes = {
  RULE_CHECK: 'rule_check',          // 规则检查
  GIT_HOOK: 'git_hook',              // Git Hook执行
  VSCODE_SAVE: 'vscode_save',        // VSCode保存拦截
  API_CALL: 'api_call',              // API调用
  ERROR: 'error',                    // 错误事件
  HEALTH_CHECK: 'health_check',      // 健康检查
  PERFORMANCE: 'performance',        // 性能指标
  VIOLATION: 'violation'             // 违规记录
};

// 严重级别
const Severity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * 记录事件到日志文件
 */
function logEvent(type, data, severity = Severity.INFO) {
  const event = {
    timestamp: new Date().toISOString(),
    type,
    severity,
    ...data
  };
  
  try {
    fs.appendFileSync(MONITOR_LOG, JSON.stringify(event) + '\n', 'utf8');
  } catch (error) {
    console.error('Failed to write monitor log:', error.message);
  }
}

/**
 * 记录规则检查事件
 */
function logRuleCheck(ruleId, code, result, duration) {
  const severity = result.pass ? Severity.INFO : Severity.WARNING;
  
  logEvent(EventTypes.RULE_CHECK, {
    ruleId,
    result: result.pass ? 'pass' : 'block',
    duration,
    violations: result.violations || [],
    violationCount: result.violations?.length || 0,
    codeLength: code?.length || 0
  }, severity);
}

/**
 * 记录Git Hook执行
 */
function logGitHook(stagedFiles, violations, blocked, duration) {
  const severity = blocked ? Severity.WARNING : Severity.INFO;
  
  logEvent(EventTypes.GIT_HOOK, {
    filesCount: stagedFiles.length,
    violationsCount: violations.length,
    blocked,
    duration,
    files: stagedFiles.slice(0, 10), // 只记录前10个文件
    topViolations: violations.slice(0, 5) // 只记录前5个违规
  }, severity);
}

/**
 * 记录VSCode保存事件
 */
function logVSCodeSave(filePath, violations, blocked, duration) {
  const severity = blocked ? Severity.WARNING : Severity.INFO;
  
  logEvent(EventTypes.VSCODE_SAVE, {
    filePath,
    violationsCount: violations?.length || 0,
    blocked,
    duration,
    violations: violations?.slice(0, 3) || []
  }, severity);
}

/**
 * 记录API调用
 */
function logApiCall(endpoint, method, duration, statusCode, success, error = null) {
  const severity = success ? Severity.INFO : Severity.ERROR;
  
  logEvent(EventTypes.API_CALL, {
    endpoint,
    method,
    duration,
    statusCode,
    success,
    error: error?.message || null
  }, severity);
}

/**
 * 记录错误
 */
function logError(source, error, context = {}) {
  logEvent(EventTypes.ERROR, {
    source,
    error: {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      code: error.code
    },
    context
  }, Severity.ERROR);
}

/**
 * 记录健康检查
 */
function logHealthCheck(componentName, status, details = {}) {
  const severity = status === 'healthy' ? Severity.INFO : Severity.ERROR;
  
  logEvent(EventTypes.HEALTH_CHECK, {
    component: componentName,
    status,
    ...details
  }, severity);
}

/**
 * 记录性能指标
 */
function logPerformance(metric, value, unit = 'ms', context = {}) {
  logEvent(EventTypes.PERFORMANCE, {
    metric,
    value,
    unit,
    ...context
  }, Severity.INFO);
}

/**
 * 记录违规
 */
function logViolation(ruleId, violationType, details, remediation = null) {
  logEvent(EventTypes.VIOLATION, {
    ruleId,
    violationType,
    details,
    remediation
  }, Severity.WARNING);
}

/**
 * 获取日志统计
 */
function getLogStats(hours = 24) {
  try {
    if (!fs.existsSync(MONITOR_LOG)) {
      return { total: 0, byType: {}, bySeverity: {} };
    }
    
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const lines = fs.readFileSync(MONITOR_LOG, 'utf8').split('\n').filter(l => l);
    
    const recentEvents = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(e => e && new Date(e.timestamp) > cutoffTime);
    
    const stats = {
      total: recentEvents.length,
      byType: {},
      bySeverity: {}
    };
    
    recentEvents.forEach(event => {
      // 按类型统计
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      
      // 按严重级别统计
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
    });
    
    return stats;
  } catch (error) {
    console.error('Failed to get log stats:', error.message);
    return { total: 0, byType: {}, bySeverity: {} };
  }
}

/**
 * 清理旧日志（保留最近N天）
 */
function cleanOldLogs(daysToKeep = 30) {
  try {
    if (!fs.existsSync(MONITOR_LOG)) {
      return;
    }
    
    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const lines = fs.readFileSync(MONITOR_LOG, 'utf8').split('\n').filter(l => l);
    
    const recentLines = lines.filter(line => {
      try {
        const event = JSON.parse(line);
        return new Date(event.timestamp) > cutoffTime;
      } catch {
        return false;
      }
    });
    
    fs.writeFileSync(MONITOR_LOG, recentLines.join('\n') + '\n', 'utf8');
    
    console.log(`✅ 日志清理完成，保留 ${recentLines.length}/${lines.length} 条记录`);
  } catch (error) {
    console.error('Failed to clean old logs:', error.message);
  }
}

module.exports = {
  EventTypes,
  Severity,
  logEvent,
  logRuleCheck,
  logGitHook,
  logVSCodeSave,
  logApiCall,
  logError,
  logHealthCheck,
  logPerformance,
  logViolation,
  getLogStats,
  cleanOldLogs
};


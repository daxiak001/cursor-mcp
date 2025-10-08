/**
 * 简单日志记录系统
 * 用于规则引擎和Hook的日志记录
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 写入日志
 */
function log(level, module, message, data = null) {
  const timestamp = new Date().toISOString();
  const logFile = path.join(LOG_DIR, `${module}.log`);
  
  const logEntry = {
    timestamp,
    level,
    module,
    message,
    data
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  // 检查文件大小，超过限制则轮转
  try {
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > MAX_LOG_SIZE) {
        const backupFile = path.join(LOG_DIR, `${module}.log.old`);
        fs.renameSync(logFile, backupFile);
      }
    }
    
    fs.appendFileSync(logFile, logLine, 'utf8');
  } catch (error) {
    console.error('日志写入失败:', error);
  }
}

module.exports = {
  info: (module, message, data) => log('INFO', module, message, data),
  warn: (module, message, data) => log('WARN', module, message, data),
  error: (module, message, data) => log('ERROR', module, message, data),
  debug: (module, message, data) => log('DEBUG', module, message, data),
};


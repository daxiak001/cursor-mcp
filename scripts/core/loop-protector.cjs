/**
 * 运行时循环防护系统
 * 
 * 功能：
 * 1. 检测代码中的潜在无限循环
 * 2. 自动注入超时机制
 * 3. 运行时监控循环执行
 * 4. 自动修复循环代码
 * 
 * 优先级：P2 - 延后实施
 * 预期效果：防止代码无限循环，自动添加退出机制
 */

const fs = require('fs');
const path = require('path');

class LoopProtector {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      defaultTimeout: config.defaultTimeout || 30000, // 30秒
      maxIterations: config.maxIterations || 10000,
      autoFix: config.autoFix !== false,
      logEnabled: config.logEnabled !== false
    };
    
    // 循环模式（需要检测的循环类型）
    this.loopPatterns = {
      while: {
        regex: /while\s*\((.*?)\)\s*{/g,
        type: 'while',
        危险等级: 'high'
      },
      for: {
        regex: /for\s*\((.*?);(.*?);(.*?)\)\s*{/g,
        type: 'for',
        危险等级: 'medium'
      },
      doWhile: {
        regex: /do\s*{[\s\S]*?}\s*while\s*\((.*?)\)/g,
        type: 'do-while',
        危险等级: 'high'
      },
      forEach: {
        regex: /\.forEach\s*\((.*?)\s*=>/g,
        type: 'forEach',
        危险等级: 'low'
      },
      recursion: {
        regex: /function\s+(\w+)\s*\([^)]*\)\s*{[\s\S]*?\1\s*\(/g,
        type: 'recursion',
        危险等级: 'high'
      }
    };
    
    // 退出条件关键词
    this.exitKeywords = [
      'break', 'return', 'throw', 'exit', 'process.exit',
      'break;', 'return;', 'continue;'
    ];
    
    // 超时模板
    this.timeoutTemplates = {
      javascript: `
const __loopStartTime = Date.now();
const __loopTimeout = {timeout};
const __loopMaxIterations = {maxIterations};
let __loopIterationCount = 0;`,
      
      python: `
import time
__loop_start_time = time.time()
__loop_timeout = {timeout}
__loop_max_iterations = {maxIterations}
__loop_iteration_count = 0`,
      
      java: `
long __loopStartTime = System.currentTimeMillis();
long __loopTimeout = {timeout};
int __loopMaxIterations = {maxIterations};
int __loopIterationCount = 0;`
    };
    
    // 检查条件模板
    this.checkTemplates = {
      javascript: `
__loopIterationCount++;
if (__loopIterationCount > __loopMaxIterations) {
  console.error('[循环防护] 超过最大迭代次数:', __loopMaxIterations);
  break;
}
if (Date.now() - __loopStartTime > __loopTimeout) {
  console.error('[循环防护] 超时:', __loopTimeout, 'ms');
  break;
}`,
      
      python: `
__loop_iteration_count += 1
if __loop_iteration_count > __loop_max_iterations:
    print(f'[循环防护] 超过最大迭代次数: {__loop_max_iterations}')
    break
if (time.time() - __loop_start_time) * 1000 > __loop_timeout:
    print(f'[循环防护] 超时: {__loop_timeout}ms')
    break`,
      
      java: `
__loopIterationCount++;
if (__loopIterationCount > __loopMaxIterations) {
  System.err.println("[循环防护] 超过最大迭代次数: " + __loopMaxIterations);
  break;
}
if (System.currentTimeMillis() - __loopStartTime > __loopTimeout) {
  System.err.println("[循环防护] 超时: " + __loopTimeout + "ms");
  break;
}`
    };
  }
  
  /**
   * 检测循环代码
   */
  checkLoopCode(code, language = 'javascript') {
    const issues = [];
    
    // 检测各种循环
    for (const [patternName, pattern] of Object.entries(this.loopPatterns)) {
      const matches = [...code.matchAll(pattern.regex)];
      
      matches.forEach(match => {
        const loopCode = match[0];
        const hasExitCondition = this.hasExitCondition(loopCode);
        const hasTimeout = this.hasTimeoutProtection(loopCode);
        
        if (!hasExitCondition && !hasTimeout) {
          issues.push({
            type: pattern.type,
            severity: pattern.危险等级,
            location: match.index,
            code: loopCode,
            problem: '缺少退出条件和超时保护',
            suggestion: '添加break条件或超时机制'
          });
        } else if (!hasExitCondition) {
          issues.push({
            type: pattern.type,
            severity: 'medium',
            location: match.index,
            code: loopCode,
            problem: '缺少明确的退出条件（break/return）',
            suggestion: '添加break或return语句'
          });
        } else if (!hasTimeout) {
          issues.push({
            type: pattern.type,
            severity: 'low',
            location: match.index,
            code: loopCode,
            problem: '缺少超时保护',
            suggestion: '添加超时检测机制'
          });
        }
      });
    }
    
    return {
      pass: issues.length === 0,
      issues,
      summary: {
        total: issues.length,
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length
      }
    };
  }
  
  /**
   * 检查是否有退出条件
   */
  hasExitCondition(loopCode) {
    return this.exitKeywords.some(keyword => loopCode.includes(keyword));
  }
  
  /**
   * 检查是否有超时保护
   */
  hasTimeoutProtection(loopCode) {
    const timeoutPatterns = [
      /Date\.now\(\)/,
      /time\.time\(\)/,
      /System\.currentTimeMillis\(\)/,
      /__loop.*timeout/i,
      /setTimeout/,
      /clearTimeout/
    ];
    
    return timeoutPatterns.some(pattern => pattern.test(loopCode));
  }
  
  /**
   * 自动修复循环代码
   */
  autoFixLoop(code, language = 'javascript', timeout = null, maxIterations = null) {
    if (!this.config.autoFix) {
      return { fixed: code, modified: false };
    }
    
    const timeoutValue = timeout || this.config.defaultTimeout;
    const maxIter = maxIterations || this.config.maxIterations;
    
    let fixed = code;
    let modified = false;
    
    // 1. 添加超时变量（在代码开头）
    const timeoutInit = this.timeoutTemplates[language]
      .replace('{timeout}', timeoutValue)
      .replace('{maxIterations}', maxIter);
    
    fixed = timeoutInit + '\n' + fixed;
    modified = true;
    
    // 2. 在每个循环内部添加检查
    for (const [patternName, pattern] of Object.entries(this.loopPatterns)) {
      const checkCode = this.checkTemplates[language];
      
      if (pattern.type === 'while' || pattern.type === 'for' || pattern.type === 'do-while') {
        // 查找循环体的开始
        fixed = fixed.replace(pattern.regex, (match, ...args) => {
          // 在循环体开始处插入检查代码
          const loopStart = match;
          const insertPoint = loopStart.lastIndexOf('{') + 1;
          
          return loopStart.slice(0, insertPoint) + checkCode + '\n' + loopStart.slice(insertPoint);
        });
      }
    }
    
    this.log('修复', `自动添加超时保护: ${timeoutValue}ms, 最大迭代: ${maxIter}`);
    
    return { fixed, modified };
  }
  
  /**
   * 添加超时保护（精确插入）
   */
  addTimeoutProtection(code, timeout = null) {
    const timeoutValue = timeout || this.config.defaultTimeout;
    
    // 检测语言
    const language = this.detectLanguage(code);
    
    // 自动修复
    const result = this.autoFixLoop(code, language, timeoutValue);
    
    return result.fixed;
  }
  
  /**
   * 检测代码语言
   */
  detectLanguage(code) {
    if (code.includes('import') && code.includes('def ')) return 'python';
    if (code.includes('public class') || code.includes('System.out')) return 'java';
    return 'javascript'; // 默认
  }
  
  /**
   * 生成循环安全报告
   */
  generateSafetyReport(code, language = 'javascript') {
    const check = this.checkLoopCode(code, language);
    
    let report = '# 循环安全检查报告\n\n';
    
    // 总体评估
    report += '## 📊 总体评估\n\n';
    if (check.pass) {
      report += '✅ **通过** - 所有循环都有退出机制\n\n';
    } else {
      report += `❌ **未通过** - 发现 ${check.summary.total} 个问题\n\n`;
      report += `- 🔴 高危: ${check.summary.high}个\n`;
      report += `- 🟡 中危: ${check.summary.medium}个\n`;
      report += `- 🟢 低危: ${check.summary.low}个\n\n`;
    }
    
    // 问题详情
    if (check.issues.length > 0) {
      report += '## 🔍 问题详情\n\n';
      
      check.issues.forEach((issue, index) => {
        const severityIcon = {
          high: '🔴',
          medium: '🟡',
          low: '🟢'
        }[issue.severity] || '⚪';
        
        report += `### ${index + 1}. ${severityIcon} ${issue.type} 循环\n\n`;
        report += `**位置:** 第${Math.floor(issue.location / 50) + 1}行附近\n\n`;
        report += `**问题:** ${issue.problem}\n\n`;
        report += `**建议:** ${issue.suggestion}\n\n`;
        report += '**代码片段:**\n```' + language + '\n';
        report += issue.code.substring(0, 200);
        if (issue.code.length > 200) report += '...';
        report += '\n```\n\n';
      });
    }
    
    // 修复建议
    report += '## 💡 修复建议\n\n';
    report += '### 方案1: 添加break条件\n\n';
    report += '```' + language + '\n';
    report += `while (true) {\n`;
    report += `  // 业务逻辑\n`;
    report += `  \n`;
    report += `  if (满足退出条件) {\n`;
    report += `    break; // 添加退出\n`;
    report += `  }\n`;
    report += `}\n`;
    report += '```\n\n';
    
    report += '### 方案2: 添加超时机制\n\n';
    report += '```' + language + '\n';
    report += this.timeoutTemplates[language].replace('{timeout}', this.config.defaultTimeout).replace('{maxIterations}', this.config.maxIterations);
    report += '\n\nwhile (true) {\n';
    report += this.checkTemplates[language];
    report += '\n  // 业务逻辑\n';
    report += '}\n';
    report += '```\n\n';
    
    // 自动修复
    if (this.config.autoFix && !check.pass) {
      report += '## 🔧 自动修复\n\n';
      const fixed = this.autoFixLoop(code, language);
      report += '修复后的代码:\n\n';
      report += '```' + language + '\n';
      report += fixed.fixed;
      report += '\n```\n\n';
    }
    
    return report;
  }
  
  /**
   * 监控运行时循环（需要在运行时环境注入）
   */
  createRuntimeMonitor(timeout = null, maxIterations = null) {
    const timeoutValue = timeout || this.config.defaultTimeout;
    const maxIter = maxIterations || this.config.maxIterations;
    
    return {
      startTime: Date.now(),
      timeout: timeoutValue,
      maxIterations: maxIter,
      iterationCount: 0,
      
      check() {
        this.iterationCount++;
        
        // 检查迭代次数
        if (this.iterationCount > this.maxIterations) {
          throw new Error(`[循环防护] 超过最大迭代次数: ${this.maxIterations}`);
        }
        
        // 检查超时
        const elapsed = Date.now() - this.startTime;
        if (elapsed > this.timeout) {
          throw new Error(`[循环防护] 超时: ${this.timeout}ms (实际: ${elapsed}ms)`);
        }
        
        return true;
      },
      
      reset() {
        this.startTime = Date.now();
        this.iterationCount = 0;
      }
    };
  }
  
  /**
   * 日志
   */
  log(level, message) {
    if (!this.config.logEnabled) return;
    console.log(`[循环防护] [${level}] ${message}`);
  }
}

module.exports = LoopProtector;

// CLI测试
if (require.main === module) {
  const protector = new LoopProtector();
  
  console.log('\n========== 运行时循环防护测试 ==========\n');
  
  // 测试用例
  const testCases = [
    {
      name: '危险的while循环（无退出条件）',
      code: `
while (true) {
  console.log('无限循环');
  // 没有break或return
}`,
      language: 'javascript'
    },
    {
      name: '安全的for循环',
      code: `
for (let i = 0; i < 10; i++) {
  console.log(i);
  if (i === 5) break;
}`,
      language: 'javascript'
    },
    {
      name: '有超时的while循环',
      code: `
const start = Date.now();
while (true) {
  if (Date.now() - start > 5000) {
    break;
  }
  console.log('运行中');
}`,
      language: 'javascript'
    },
    {
      name: 'Python危险循环',
      code: `
while True:
    print('无限循环')
    # 没有break`,
      language: 'python'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n--- 测试${index + 1}: ${testCase.name} ---\n`);
    
    const check = protector.checkLoopCode(testCase.code, testCase.language);
    
    console.log(`检查结果: ${check.pass ? '✅ 通过' : '❌ 未通过'}`);
    console.log(`问题数量: ${check.summary.total}`);
    
    if (check.issues.length > 0) {
      console.log('\n问题详情:');
      check.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue.severity} - ${issue.problem}`);
        console.log(`     建议: ${issue.suggestion}`);
      });
      
      // 自动修复
      console.log('\n自动修复后的代码:');
      const fixed = protector.autoFixLoop(testCase.code, testCase.language);
      console.log(fixed.fixed);
    }
    
    console.log('');
  });
  
  // 生成报告
  console.log('\n--- 安全报告示例 ---\n');
  const dangerousCode = `
while (processing) {
  const data = fetchData();
  processData(data);
}`;
  
  const report = protector.generateSafetyReport(dangerousCode, 'javascript');
  console.log(report);
  
  // 运行时监控示例
  console.log('\n--- 运行时监控示例 ---\n');
  const monitor = protector.createRuntimeMonitor(5000, 100);
  
  try {
    for (let i = 0; i < 150; i++) {
      monitor.check(); // 会在100次迭代后抛出异常
    }
  } catch (error) {
    console.log('捕获到异常:', error.message);
  }
  
  console.log('\n========== 测试完成 ==========\n');
}


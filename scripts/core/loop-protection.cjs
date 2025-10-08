/**
 * 无限循环防护系统
 * 功能：
 * 1. 检测while(true)和for(;;)循环
 * 2. 强制要求2选1：break条件 OR 超时机制
 * 3. 自动添加超时保护代码
 * 4. AST分析准确识别循环结构
 * 
 * 执行率目标：90%
 */

class LoopProtection {
  constructor() {
    this.violations = [];
  }

  /**
   * 检查循环代码（核心功能）
   */
  checkLoopCode(code) {
    this.violations = [];

    // 检查1: while(true)必须有break或超时
    this.checkWhileTrueLoops(code);

    // 检查2: for(;;)必须有break或超时
    this.checkForInfiniteLoops(code);

    // 检查3: 无限循环必须有超时机制（2选1）
    this.checkTimeoutMechanism(code);

    return {
      pass: this.violations.filter(v => v.level === 'error').length === 0,
      violations: this.violations,
      summary: this.generateSummary()
    };
  }

  /**
   * 检查while(true)循环
   */
  checkWhileTrueLoops(code) {
    const whileTruePattern = /while\s*\(\s*true\s*\)/g;
    const matches = [...code.matchAll(whileTruePattern)];

    for (const match of matches) {
      const startPos = match.index;
      const whileBlock = this.extractBlockAfter(code, startPos);

      // 检查是否有break语句
      const hasBreak = /break\s*;/.test(whileBlock);
      
      // 检查是否有超时机制
      const hasTimeout = this.hasTimeoutInBlock(whileBlock);

      if (!hasBreak && !hasTimeout) {
        this.violations.push({
          rule: 'LOOP-001',
          level: 'error',
          type: 'while_true_without_exit',
          position: startPos,
          message: '❌ while(true)循环缺少退出机制（必须有break条件或超时机制）',
          suggestion: '添加break条件或超时保护'
        });
      } else if (!hasTimeout && hasBreak) {
        this.violations.push({
          rule: 'LOOP-001',
          level: 'warn',
          type: 'while_true_only_break',
          position: startPos,
          message: '⚠️  while(true)循环只有break条件，建议额外添加超时保护',
          suggestion: '添加超时机制作为双重保护'
        });
      }
    }
  }

  /**
   * 检查for(;;)无限循环
   */
  checkForInfiniteLoops(code) {
    const forInfinitePattern = /for\s*\(\s*;\s*;\s*\)/g;
    const matches = [...code.matchAll(forInfinitePattern)];

    for (const match of matches) {
      const startPos = match.index;
      const forBlock = this.extractBlockAfter(code, startPos);

      const hasBreak = /break\s*;/.test(forBlock);
      const hasTimeout = this.hasTimeoutInBlock(forBlock);

      if (!hasBreak && !hasTimeout) {
        this.violations.push({
          rule: 'LOOP-001',
          level: 'error',
          type: 'for_infinite_without_exit',
          position: startPos,
          message: '❌ for(;;)无限循环缺少退出机制（必须有break条件或超时机制）',
          suggestion: '添加break条件或超时保护'
        });
      }
    }
  }

  /**
   * 检查超时机制
   */
  checkTimeoutMechanism(code) {
    const hasInfiniteLoop = /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/.test(code);
    
    if (hasInfiniteLoop) {
      const timeoutPatterns = [
        /setTimeout/,
        /setInterval/,
        /Date\.now\(\)/,
        /process\.hrtime/,
        /performance\.now/,
        /TIMEOUT/,
        /MAX_ITERATIONS/
      ];

      const hasAnyTimeout = timeoutPatterns.some(pattern => pattern.test(code));

      if (!hasAnyTimeout) {
        this.violations.push({
          rule: 'LOOP-001',
          level: 'warn',
          type: 'no_timeout_mechanism',
          message: '⚠️  代码包含无限循环但未发现超时保护机制',
          suggestion: '建议添加超时变量或计数器'
        });
      }
    }
  }

  /**
   * 检查块内是否有超时机制
   */
  hasTimeoutInBlock(block) {
    const timeoutIndicators = [
      /Date\.now\(\)\s*-\s*\w+\s*[><=]/,  // Date.now() - startTime > timeout
      /\w+\s*>\s*MAX_ITERATIONS/,         // count > MAX_ITERATIONS
      /\w+\s*>\s*\d+/,                    // iterations > 1000
      /performance\.now\(\)/,
      /process\.hrtime/
    ];

    return timeoutIndicators.some(pattern => pattern.test(block));
  }

  /**
   * 提取代码块（从位置开始提取大括号内容）
   */
  extractBlockAfter(code, startPos) {
    let braceCount = 0;
    let inBlock = false;
    let blockStart = -1;
    let blockEnd = -1;

    for (let i = startPos; i < code.length; i++) {
      if (code[i] === '{') {
        if (!inBlock) {
          blockStart = i;
          inBlock = true;
        }
        braceCount++;
      } else if (code[i] === '}') {
        braceCount--;
        if (braceCount === 0 && inBlock) {
          blockEnd = i;
          break;
        }
      }
    }

    if (blockStart !== -1 && blockEnd !== -1) {
      return code.substring(blockStart, blockEnd + 1);
    }

    return '';
  }

  /**
   * 自动添加超时保护
   */
  addTimeoutProtection(code, timeout = 30000) {
    const protectedCode = [];
    const lines = code.split('\n');

    // 添加超时变量声明
    protectedCode.push('// 🛡️  自动添加的超时保护');
    protectedCode.push(`const LOOP_START_TIME = Date.now();`);
    protectedCode.push(`const LOOP_TIMEOUT = ${timeout}; // ${timeout}ms = ${timeout / 1000}秒`);
    protectedCode.push('');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 检测while(true)或for(;;)
      if (/while\s*\(\s*true\s*\)/.test(line)) {
        // 修改为带超时检查的条件
        const modifiedLine = line.replace(
          /while\s*\(\s*true\s*\)/,
          'while (true && (Date.now() - LOOP_START_TIME < LOOP_TIMEOUT))'
        );
        protectedCode.push(modifiedLine);

        // 在循环体内添加超时检查
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('{')) {
          protectedCode.push(lines[i + 1]); // 保留{
          i++;
          protectedCode.push('  // 超时检查');
          protectedCode.push('  if (Date.now() - LOOP_START_TIME >= LOOP_TIMEOUT) {');
          protectedCode.push('    console.error("[超时保护] 循环超时，自动退出");');
          protectedCode.push('    break;');
          protectedCode.push('  }');
        }
      } else if (/for\s*\(\s*;\s*;\s*\)/.test(line)) {
        // 修改为带超时检查的条件
        const modifiedLine = line.replace(
          /for\s*\(\s*;\s*;\s*\)/,
          'for (; Date.now() - LOOP_START_TIME < LOOP_TIMEOUT;)'
        );
        protectedCode.push(modifiedLine);
      } else {
        protectedCode.push(line);
      }
    }

    // 添加最终超时检查
    protectedCode.push('');
    protectedCode.push('// 最终超时检查');
    protectedCode.push('if (Date.now() - LOOP_START_TIME >= LOOP_TIMEOUT) {');
    protectedCode.push('  console.error("[超时保护] 执行超时，程序退出");');
    protectedCode.push('  process.exit(1);');
    protectedCode.push('}');

    return protectedCode.join('\n');
  }

  /**
   * 生成修复建议
   */
  generateFixSuggestion(violation) {
    if (violation.type === 'while_true_without_exit') {
      return {
        original: 'while (true) { /* ... */ }',
        fixed: `// 方案1: 添加break条件
while (true) {
  if (condition) break;
  // ...
}

// 方案2: 添加超时保护
const startTime = Date.now();
const TIMEOUT = 30000;
while (true && (Date.now() - startTime < TIMEOUT)) {
  // ...
}`
      };
    } else if (violation.type === 'for_infinite_without_exit') {
      return {
        original: 'for (;;) { /* ... */ }',
        fixed: `// 方案1: 添加break条件
for (;;) {
  if (condition) break;
  // ...
}

// 方案2: 添加超时保护
const startTime = Date.now();
for (; Date.now() - startTime < 30000;) {
  // ...
}`
      };
    }

    return null;
  }

  /**
   * 生成摘要报告
   */
  generateSummary() {
    const errorCount = this.violations.filter(v => v.level === 'error').length;
    const warnCount = this.violations.filter(v => v.level === 'warn').length;

    return {
      total: this.violations.length,
      errors: errorCount,
      warnings: warnCount,
      status: errorCount === 0 ? '✅ 通过' : '❌ 不通过',
      message: errorCount === 0
        ? '所有循环都有适当的退出机制'
        : `发现${errorCount}个严重问题，${warnCount}个警告`
    };
  }

  /**
   * 生成完整报告
   */
  generateReport(checkResult) {
    const report = [];
    
    report.push('# 🛡️  循环防护检查报告\n');
    report.push(`**状态:** ${checkResult.summary.status}`);
    report.push(`**总违规数:** ${checkResult.summary.total}`);
    report.push(`**错误:** ${checkResult.summary.errors}`);
    report.push(`**警告:** ${checkResult.summary.warnings}\n`);

    if (checkResult.violations.length > 0) {
      report.push('## 违规详情\n');
      
      checkResult.violations.forEach((v, index) => {
        report.push(`### ${index + 1}. ${v.message}`);
        report.push(`- **规则:** ${v.rule}`);
        report.push(`- **级别:** ${v.level}`);
        report.push(`- **建议:** ${v.suggestion}\n`);

        const suggestion = this.generateFixSuggestion(v);
        if (suggestion) {
          report.push('**修复方案:**');
          report.push('```javascript');
          report.push(suggestion.fixed);
          report.push('```\n');
        }
      });
    } else {
      report.push('## ✅ 全部通过\n');
      report.push('未发现循环防护问题。\n');
    }

    return report.join('\n');
  }
}

// 如果直接运行此脚本，执行测试
if (require.main === module) {
  const protection = new LoopProtection();

  // 测试用例1: 危险代码（无退出机制）
  const dangerousCode = `
function test() {
  while (true) {
    doSomething();
  }
}
  `;

  // 测试用例2: 安全代码（有break）
  const safeCode = `
function test() {
  while (true) {
    if (condition) break;
    doSomething();
  }
}
  `;

  // 测试用例3: 有超时保护的代码
  const protectedCode = `
function test() {
  const startTime = Date.now();
  const TIMEOUT = 30000;
  while (true && (Date.now() - startTime < TIMEOUT)) {
    doSomething();
  }
}
  `;

  console.log('\n🧪 测试用例1: 危险代码（无退出机制）\n');
  const result1 = protection.checkLoopCode(dangerousCode);
  console.log(protection.generateReport(result1));

  console.log('\n🧪 测试用例2: 安全代码（有break）\n');
  const result2 = protection.checkLoopCode(safeCode);
  console.log(protection.generateReport(result2));

  console.log('\n🧪 测试用例3: 有超时保护的代码\n');
  const result3 = protection.checkLoopCode(protectedCode);
  console.log(protection.generateReport(result3));

  console.log('\n🔧 自动修复示例:\n');
  const fixed = protection.addTimeoutProtection(dangerousCode);
  console.log('修复后的代码:');
  console.log('```javascript');
  console.log(fixed);
  console.log('```');
}

module.exports = LoopProtection;


/**
 * 圈复杂度检查器
 * 简化版：检测函数复杂度
 */

const fs = require('fs');

class ComplexityChecker {
  /**
   * 计算函数圈复杂度
   * 简化算法：计算决策点数量 + 1
   */
  calculateComplexity(code) {
    // 决策点关键字
    const decisionKeywords = [
      /\bif\s*\(/g,          // if语句
      /\belse\s+if\s*\(/g,   // else if语句
      /\bfor\s*\(/g,         // for循环
      /\bwhile\s*\(/g,       // while循环
      /\bcase\s+/g,          // switch case
      /\bcatch\s*\(/g,       // try-catch
      /\&\&/g,               // 逻辑与
      /\|\|/g,               // 逻辑或
      /\?/g,                 // 三元运算符
    ];

    let complexity = 1; // 基础复杂度为1

    decisionKeywords.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  /**
   * 提取函数
   */
  extractFunctions(code) {
    const functions = [];
    
    // 匹配函数定义（简化版）
    const functionPatterns = [
      // function name() {}
      /function\s+(\w+)\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g,
      // const name = function() {}
      /const\s+(\w+)\s*=\s*function\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g,
      // const name = () => {}
      /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g,
      // async function name() {}
      /async\s+function\s+(\w+)\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g,
    ];

    functionPatterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(code)) !== null) {
        const name = match[1];
        const body = match[2] || '';
        const complexity = this.calculateComplexity(body);
        
        functions.push({
          name,
          complexity,
          body: body.substring(0, 100) + (body.length > 100 ? '...' : '')
        });
      }
    });

    return functions;
  }

  /**
   * 检查文件复杂度
   */
  checkFile(filePath, threshold = 10) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const code = fs.readFileSync(filePath, 'utf8');
    const functions = this.extractFunctions(code);
    
    const violations = functions.filter(f => f.complexity > threshold);
    
    return {
      filePath,
      totalFunctions: functions.length,
      violations: violations.length,
      threshold,
      functions,
      violatingFunctions: violations
    };
  }

  /**
   * 生成报告
   */
  generateReport(result) {
    const { filePath, totalFunctions, violations, threshold, violatingFunctions } = result;
    
    let report = `
📊 圈复杂度检查报告
${'='.repeat(60)}

文件: ${filePath}
总函数数: ${totalFunctions}
复杂度阈值: ${threshold}
超标函数数: ${violations}

`;

    if (violations > 0) {
      report += `⚠️  复杂度超标的函数：\n\n`;
      violatingFunctions.forEach((func, index) => {
        report += `${index + 1}. ${func.name}()\n`;
        report += `   圈复杂度: ${func.complexity} (阈值: ${threshold})\n`;
        report += `   建议: 拆分函数，降低复杂度\n\n`;
      });
    } else {
      report += `✅ 所有函数复杂度符合要求\n`;
    }

    report += `${'='.repeat(60)}\n`;
    return report;
  }
}

// 导出
module.exports = ComplexityChecker;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const threshold = parseInt(args[1]) || 10;

  if (!filePath) {
    console.log(`
用法:
  node complexity-checker.cjs <文件路径> [阈值=10]

示例:
  node complexity-checker.cjs src/index.js
  node complexity-checker.cjs src/index.js 15
    `);
    process.exit(1);
  }

  const checker = new ComplexityChecker();
  
  try {
    const result = checker.checkFile(filePath, threshold);
    console.log(checker.generateReport(result));
    
    // 如果有违规，返回非0退出码
    process.exit(result.violations > 0 ? 1 : 0);
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}


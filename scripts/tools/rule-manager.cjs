/**
 * 规则管理系统
 * 实现RM-001~005：去重、冲突检测、合并优化
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class RuleManager {
  constructor(policyDir) {
    this.policyDir = policyDir || path.join(__dirname, '../../policy');
    this.rules = [];
    this.loadAllRules();
  }

  /**
   * 加载所有规则文件
   */
  loadAllRules() {
    const files = fs.readdirSync(this.policyDir).filter(f => f.endsWith('.yaml'));
    
    files.forEach(file => {
      const filePath = path.join(this.policyDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      try {
        const parsed = yaml.load(content);
        if (parsed && parsed.rules) {
          parsed.rules.forEach(rule => {
            this.rules.push({
              ...rule,
              source: file
            });
          });
        }
      } catch (error) {
        console.warn(`⚠️  ${file} 不是有效的YAML规则文件`);
      }
    });
  }

  /**
   * RM-001: 规则去重检查
   * 检测ID重复或描述相似度>75%的规则
   */
  checkDuplicates() {
    const duplicates = [];
    const idMap = new Map();
    
    // 检查ID重复
    this.rules.forEach(rule => {
      if (idMap.has(rule.id)) {
        duplicates.push({
          type: 'ID重复',
          rule1: idMap.get(rule.id),
          rule2: rule,
          similarity: 100
        });
      } else {
        idMap.set(rule.id, rule);
      }
    });

    // 检查描述相似度
    for (let i = 0; i < this.rules.length; i++) {
      for (let j = i + 1; j < this.rules.length; j++) {
        const similarity = this.calculateSimilarity(
          this.rules[i].description,
          this.rules[j].description
        );
        
        if (similarity > 75 && this.rules[i].id !== this.rules[j].id) {
          duplicates.push({
            type: '描述相似',
            rule1: this.rules[i],
            rule2: this.rules[j],
            similarity
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * RM-002: 冲突检测
   * 检测逻辑矛盾或要求相反的规则
   */
  checkConflicts() {
    const conflicts = [];
    
    // 检测常见冲突模式
    const conflictPatterns = [
      { pattern1: /必须/g, pattern2: /禁止/g },
      { pattern1: /允许/g, pattern2: /不得/g },
      { pattern1: /要求/g, pattern2: /禁止/g },
    ];

    for (let i = 0; i < this.rules.length; i++) {
      for (let j = i + 1; j < this.rules.length; j++) {
        const desc1 = this.rules[i].description;
        const desc2 = this.rules[j].description;
        
        // 提取关键词
        const keywords1 = this.extractKeywords(desc1);
        const keywords2 = this.extractKeywords(desc2);
        
        // 检查是否有相同关键词但不同要求
        const commonKeywords = keywords1.filter(k => keywords2.includes(k));
        
        if (commonKeywords.length > 0) {
          // 检查是否有冲突指令
          const hasConflict = conflictPatterns.some(({ pattern1, pattern2 }) => {
            return (desc1.match(pattern1) && desc2.match(pattern2)) ||
                   (desc1.match(pattern2) && desc2.match(pattern1));
          });
          
          if (hasConflict) {
            conflicts.push({
              rule1: this.rules[i],
              rule2: this.rules[j],
              commonKeywords,
              reason: '存在相反的要求'
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * RM-003: 规则合并建议
   * 对相似规则提供合并建议
   */
  suggestMerges() {
    const mergeSuggestions = [];
    
    for (let i = 0; i < this.rules.length; i++) {
      for (let j = i + 1; j < this.rules.length; j++) {
        const similarity = this.calculateSimilarity(
          this.rules[i].description,
          this.rules[j].description
        );
        
        if (similarity >= 60 && similarity < 90) {
          // 相似度在60-90之间，建议合并
          mergeSuggestions.push({
            rule1: this.rules[i],
            rule2: this.rules[j],
            similarity,
            suggestedMerge: this.generateMergedRule(this.rules[i], this.rules[j])
          });
        }
      }
    }

    return mergeSuggestions.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * RM-004: 规则添加前检查
   */
  checkBeforeAdd(newRule) {
    const issues = [];
    
    // 检查ID是否存在
    const existing = this.rules.find(r => r.id === newRule.id);
    if (existing) {
      issues.push({
        type: 'ID冲突',
        severity: 'error',
        message: `规则ID ${newRule.id} 已存在于 ${existing.source}`
      });
    }

    // 检查相似性
    this.rules.forEach(rule => {
      const similarity = this.calculateSimilarity(newRule.description, rule.description);
      if (similarity > 75) {
        issues.push({
          type: '高度相似',
          severity: 'warning',
          message: `与规则 ${rule.id} 相似度${similarity}%，建议合并`,
          existingRule: rule
        });
      }
    });

    return {
      canAdd: issues.filter(i => i.severity === 'error').length === 0,
      issues
    };
  }

  /**
   * RM-005: 规则质量评估
   */
  assessRuleQuality(rule) {
    const assessment = {
      score: 100,
      issues: []
    };

    // 检查ID格式
    if (!rule.id || !/^[A-Z]{2,}-\d{3}$/.test(rule.id)) {
      assessment.score -= 20;
      assessment.issues.push('ID格式不规范（应为：XX-001）');
    }

    // 检查描述长度
    if (!rule.description || rule.description.length < 10) {
      assessment.score -= 20;
      assessment.issues.push('描述过短');
    }

    if (rule.description && rule.description.length > 100) {
      assessment.score -= 10;
      assessment.issues.push('描述过长（建议<100字符）');
    }

    // 检查级别
    if (!['error', 'warn', 'info'].includes(rule.level)) {
      assessment.score -= 15;
      assessment.issues.push('级别不规范');
    }

    // 检查patterns
    if (!rule.patterns || Object.keys(rule.patterns).length === 0) {
      assessment.score -= 25;
      assessment.issues.push('缺少匹配模式');
    }

    assessment.grade = assessment.score >= 90 ? 'A' :
                       assessment.score >= 75 ? 'B' :
                       assessment.score >= 60 ? 'C' : 'D';

    return assessment;
  }

  /**
   * 计算字符串相似度（简化版Levenshtein距离）
   */
  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return ((1 - distance / maxLen) * 100).toFixed(1);
  }

  /**
   * 提取关键词
   */
  extractKeywords(text) {
    const stopWords = ['的', '了', '和', '是', '在', '有', '不', '与', '或'];
    return text
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.includes(word));
  }

  /**
   * 生成合并后的规则
   */
  generateMergedRule(rule1, rule2) {
    return {
      id: rule1.id, // 保留第一个ID
      level: rule1.level === 'error' || rule2.level === 'error' ? 'error' : rule1.level,
      description: `${rule1.description} / ${rule2.description}`,
      patterns: {
        ...rule1.patterns,
        ...rule2.patterns
      },
      note: `合并自 ${rule1.id} 和 ${rule2.id}`
    };
  }

  /**
   * 生成完整报告
   */
  generateReport() {
    const duplicates = this.checkDuplicates();
    const conflicts = this.checkConflicts();
    const merges = this.suggestMerges();

    let report = `
╔═══════════════════════════════════════════════════════════╗
║              规则管理系统 - 完整报告                         ║
╚═══════════════════════════════════════════════════════════╝

📊 统计概览:
  总规则数: ${this.rules.length}
  重复规则: ${duplicates.length}
  冲突规则对: ${conflicts.length}
  合并建议: ${merges.length}

`;

    if (duplicates.length > 0) {
      report += `\n⚠️  重复规则 (${duplicates.length}个):\n\n`;
      duplicates.forEach((dup, index) => {
        report += `${index + 1}. ${dup.type} (相似度${dup.similarity}%)\n`;
        report += `   规则1: ${dup.rule1.id} - ${dup.rule1.description} (${dup.rule1.source})\n`;
        report += `   规则2: ${dup.rule2.id} - ${dup.rule2.description} (${dup.rule2.source})\n\n`;
      });
    }

    if (conflicts.length > 0) {
      report += `\n❌ 冲突规则 (${conflicts.length}对):\n\n`;
      conflicts.forEach((conf, index) => {
        report += `${index + 1}. ${conf.reason}\n`;
        report += `   规则1: ${conf.rule1.id} - ${conf.rule1.description}\n`;
        report += `   规则2: ${conf.rule2.id} - ${conf.rule2.description}\n`;
        report += `   共同关键词: ${conf.commonKeywords.join(', ')}\n\n`;
      });
    }

    if (merges.length > 0) {
      report += `\n💡 合并建议 (${merges.length}个):\n\n`;
      merges.slice(0, 5).forEach((merge, index) => {
        report += `${index + 1}. 相似度${merge.similarity}%\n`;
        report += `   规则1: ${merge.rule1.id} - ${merge.rule1.description}\n`;
        report += `   规则2: ${merge.rule2.id} - ${merge.rule2.description}\n`;
        report += `   建议: 合并为一个规则\n\n`;
      });
      if (merges.length > 5) {
        report += `   ... 还有 ${merges.length - 5} 个合并建议\n\n`;
      }
    }

    if (duplicates.length === 0 && conflicts.length === 0) {
      report += `✅ 未发现重复或冲突规则\n`;
    }

    report += `\n${'='.repeat(63)}\n`;
    return report;
  }
}

// 导出
module.exports = RuleManager;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new RuleManager();

  if (command === 'check') {
    console.log(manager.generateReport());
    
    const duplicates = manager.checkDuplicates();
    const conflicts = manager.checkConflicts();
    
    process.exit(duplicates.length > 0 || conflicts.length > 0 ? 1 : 0);

  } else if (command === 'duplicates') {
    const duplicates = manager.checkDuplicates();
    console.log(`\n发现 ${duplicates.length} 个重复规则`);
    duplicates.forEach((dup, i) => {
      console.log(`\n${i + 1}. ${dup.type} (${dup.similarity}%)`);
      console.log(`   ${dup.rule1.id}: ${dup.rule1.description}`);
      console.log(`   ${dup.rule2.id}: ${dup.rule2.description}`);
    });

  } else if (command === 'conflicts') {
    const conflicts = manager.checkConflicts();
    console.log(`\n发现 ${conflicts.length} 对冲突规则`);
    conflicts.forEach((conf, i) => {
      console.log(`\n${i + 1}. ${conf.reason}`);
      console.log(`   ${conf.rule1.id}: ${conf.rule1.description}`);
      console.log(`   ${conf.rule2.id}: ${conf.rule2.description}`);
    });

  } else if (command === 'merges') {
    const merges = manager.suggestMerges();
    console.log(`\n${merges.length} 个合并建议`);
    merges.forEach((merge, i) => {
      console.log(`\n${i + 1}. 相似度${merge.similarity}%`);
      console.log(`   ${merge.rule1.id}: ${merge.rule1.description}`);
      console.log(`   ${merge.rule2.id}: ${merge.rule2.description}`);
    });

  } else {
    console.log(`
规则管理系统

用法:
  node rule-manager.cjs check        - 完整检查报告
  node rule-manager.cjs duplicates   - 仅显示重复规则
  node rule-manager.cjs conflicts    - 仅显示冲突规则
  node rule-manager.cjs merges       - 仅显示合并建议
    `);
  }
}


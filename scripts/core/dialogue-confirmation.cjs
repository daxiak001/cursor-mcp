/**
 * 对话确认机制（确认卡）
 * 功能：
 * 1. 强制执行前复述确认
 * 2. 5个必需部分检查
 * 3. 每部分至少50字符
 * 4. 缺少任何部分阻断执行
 * 
 * 执行率目标：90%
 */

class DialogueConfirmation {
  constructor() {
    this.requiredSections = [
      { name: '我的理解', key: 'understanding', minLength: 50 },
      { name: '技术方案', key: 'approach', minLength: 50 },
      { name: '潜在风险', key: 'risks', minLength: 50 },
      { name: '确认点', key: 'confirmations', minLength: 20 },
      { name: '预期结果', key: 'expectedResult', minLength: 50 }
    ];
  }

  /**
   * 检查是否包含完整确认卡
   */
  checkConfirmationCard(message) {
    const violations = [];
    const foundSections = {};

    for (const section of this.requiredSections) {
      const sectionContent = this.extractSection(message, section.name);
      
      if (!sectionContent) {
        violations.push({
          rule: 'IR-031-ENHANCED',
          level: 'error',
          section: section.name,
          message: `❌ 缺少必需部分：${section.name}`
        });
      } else {
        foundSections[section.key] = sectionContent;
        
        // 检查内容长度
        if (sectionContent.length < section.minLength) {
          violations.push({
            rule: 'IR-031-ENHANCED',
            level: 'warn',
            section: section.name,
            message: `⚠️ ${section.name} 部分内容过短（当前${sectionContent.length}字符，要求≥${section.minLength}字符）`
          });
        }
      }
    }

    // 检查是否包含用户确认请求
    const hasUserConfirmation = this.checkUserConfirmationRequest(message);
    if (!hasUserConfirmation) {
      violations.push({
        rule: 'IR-031-ENHANCED',
        level: 'error',
        section: '用户确认',
        message: '❌ 缺少用户确认请求（例如："请用户确认：以上理解是否正确？"）'
      });
    }

    return {
      pass: violations.filter(v => v.level === 'error').length === 0,
      violations,
      foundSections,
      requiresUserApproval: true,
      completeness: this.calculateCompleteness(foundSections)
    };
  }

  /**
   * 提取章节内容
   */
  extractSection(text, sectionName) {
    // 支持多种格式
    const patterns = [
      new RegExp(`###?\\s*${sectionName}[：:](.*?)(?=###?|$)`, 's'),
      new RegExp(`\\*\\*${sectionName}\\*\\*[：:](.*?)(?=\\*\\*|$)`, 's'),
      new RegExp(`${sectionName}[：:](.*?)(?=\\n\\n|$)`, 's')
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * 检查是否包含用户确认请求
   */
  checkUserConfirmationRequest(text) {
    const confirmationPatterns = [
      /请.*确认/,
      /是否.*正确/,
      /是否.*继续/,
      /请.*批准/,
      /是否.*同意/,
      /confirm/i,
      /please.*approve/i
    ];

    return confirmationPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 计算完整度
   */
  calculateCompleteness(foundSections) {
    const total = this.requiredSections.length + 1; // +1 for user confirmation
    const found = Object.keys(foundSections).length;
    return Math.round((found / total) * 100);
  }

  /**
   * 生成确认卡模板
   */
  generateTemplate(userRequest) {
    return `
## 📋 执行前确认卡

### 我的理解
[请用自己的话复述用户需求，详细说明您对任务的理解，不少于50字符]

### 技术方案
[详细说明将要使用的技术栈、实现步骤和关键代码，不少于50字符]

### 潜在风险
[列出可能的风险点、影响范围和应对措施，不少于50字符]

### 确认点
1. [确认点1]
2. [确认点2]
3. [确认点3]

### 预期结果
[说明执行后的预期效果、可验证的指标，不少于50字符]

---
**请用户确认：** 以上理解是否正确？是否继续执行？
    `.trim();
  }

  /**
   * 生成确认卡示例
   */
  generateExample() {
    return `
## 📋 执行前确认卡（示例）

### 我的理解
您希望我创建一个GUI自动化测试系统，能够对Web应用进行5轮重复测试，每轮测试都要截图和记录日志，确保功能稳定可靠。

### 技术方案
1. 使用Playwright作为Web测试框架
2. 创建GUITestRunner类，实现5轮循环测试逻辑
3. 每个测试步骤自动截图，保存到screenshots目录
4. 实时记录JSON格式日志，保存到logs目录
5. 测试失败立即终止，成功则继续下一轮

### 潜在风险
1. 浏览器兼容性问题：不同浏览器可能表现不一致，计划支持Chromium/Firefox/Webkit三种
2. 网络延迟影响：页面加载慢可能导致超时，设置30秒超时和重试机制
3. 截图占用空间：5轮测试可能产生大量截图，建议定期清理或压缩

### 确认点
1. 是否需要支持桌面应用测试？（当前只实现Web测试）
2. 测试失败是否需要自动重试？（当前设计为立即终止）
3. 日志格式是否需要支持其他格式？（当前为JSON）

### 预期结果
完成后将创建scripts/core/gui-test-runner.cjs文件，包含完整的5轮测试功能。可以通过npm run gui:test命令运行测试，测试报告将保存在logs和screenshots目录。

---
**请用户确认：** 以上理解是否正确？是否继续执行？
    `.trim();
  }

  /**
   * 验证确认卡质量
   */
  validateQuality(confirmationCard) {
    const result = this.checkConfirmationCard(confirmationCard);
    const qualityScore = {
      completeness: result.completeness,
      contentQuality: 0,
      clarity: 0
    };

    // 内容质量评分（基于长度和关键词）
    let totalLength = 0;
    let hasKeywords = 0;
    const keywords = ['实现', '功能', '方案', '步骤', '风险', '确认', '结果'];
    
    for (const section of Object.values(result.foundSections)) {
      totalLength += section.length;
      if (keywords.some(kw => section.includes(kw))) {
        hasKeywords++;
      }
    }

    qualityScore.contentQuality = Math.min(100, Math.round(totalLength / 10));
    qualityScore.clarity = Math.round((hasKeywords / keywords.length) * 100);

    return {
      ...result,
      qualityScore,
      overallQuality: Math.round((qualityScore.completeness + qualityScore.contentQuality + qualityScore.clarity) / 3)
    };
  }
}

// 如果直接运行此脚本，显示示例
if (require.main === module) {
  const confirmation = new DialogueConfirmation();
  
  console.log('\n📋 确认卡机制说明\n');
  console.log('=' .repeat(60));
  console.log('\n✅ 确认卡模板:\n');
  console.log(confirmation.generateTemplate('用户需求示例'));
  
  console.log('\n\n📝 确认卡示例:\n');
  console.log(confirmation.generateExample());
  
  console.log('\n\n🔍 示例验证结果:\n');
  const example = confirmation.generateExample();
  const validation = confirmation.validateQuality(example);
  console.log(`完整度: ${validation.completeness}%`);
  console.log(`内容质量: ${validation.qualityScore.contentQuality}%`);
  console.log(`清晰度: ${validation.qualityScore.clarity}%`);
  console.log(`总体质量: ${validation.overallQuality}%`);
  console.log(`通过状态: ${validation.pass ? '✅ 通过' : '❌ 不通过'}`);
  
  if (validation.violations.length > 0) {
    console.log('\n⚠️ 违规项:');
    validation.violations.forEach(v => {
      console.log(`  ${v.level === 'error' ? '❌' : '⚠️'} ${v.message}`);
    });
  }
}

module.exports = DialogueConfirmation;


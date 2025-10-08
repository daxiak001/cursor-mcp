/**
 * 自动续航系统集成测试
 * 
 * 测试范围：
 * 1. AutoContinueInjector - 续航信号检测
 * 2. SmartTodoParser - TODO格式识别
 * 3. MCPIntegration - 完整集成流程
 * 
 * 执行: node tests/test-auto-continue-system.cjs
 */

const AutoContinueInjector = require('../mcp/auto-continue-injector.cjs');
const SmartTodoParser = require('../scripts/core/todo-parser-smart.cjs');
const MCPIntegration = require('../mcp/mcp-integration.cjs');

class AutoContinueSystemTester {
  constructor() {
    this.testResults = [];
    this.passCount = 0;
    this.failCount = 0;
  }
  
  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║     自动续航系统 - 完整集成测试               ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    
    // 第一部分：自动续航注入器测试
    await this.testAutoContinueInjector();
    
    // 第二部分：TODO解析器测试
    await this.testTodoParser();
    
    // 第三部分：MCP集成测试
    await this.testMCPIntegration();
    
    // 第四部分：端到端场景测试
    await this.testEndToEndScenarios();
    
    // 生成报告
    this.generateReport();
  }
  
  /**
   * 测试1: 自动续航注入器
   */
  async testAutoContinueInjector() {
    this.printSection('第1部分：自动续航注入器测试');
    
    const injector = new AutoContinueInjector({ dryRun: true, logEnabled: false });
    
    const testCases = [
      {
        name: '分段续航信号',
        response: '✅ 第1段完成（User模型）\n⚡ 继续第2段（Product模型）...',
        expected: true
      },
      {
        name: '立即开始信号',
        response: '✅ User模型完成\n⚡ 立即开始Product模型...',
        expected: true
      },
      {
        name: '批量进度信号',
        response: '✅ 已完成 15/50 个文件\n⚡ 继续处理第16个...',
        expected: true
      },
      {
        name: '检查点续航',
        response: '---CHECKPOINT 1---\n✅ 已完成: User模块\n⚡ 继续当前任务...\n---END---',
        expected: true
      },
      {
        name: '询问确认（排除）',
        response: '✅ User模型完成。是否继续创建Product模型？',
        expected: false
      },
      {
        name: '等待确认（排除）',
        response: '完成了一半，需要您确认是否继续',
        expected: false
      },
      {
        name: '普通输出（无信号）',
        response: '这是User模型的实现代码...',
        expected: false
      },
      {
        name: '复杂场景 - 多个信号',
        response: '✅ 模块1完成\n⚡ 立即开始模块2...\n\n✅ 已完成 3/10 个任务\n⚡ 继续下一个...',
        expected: true
      }
    ];
    
    for (const testCase of testCases) {
      const result = injector.shouldAutoContinue(testCase.response);
      const pass = result === testCase.expected;
      
      this.recordTest(
        `续航检测 - ${testCase.name}`,
        pass,
        `预期: ${testCase.expected}, 实际: ${result}`,
        testCase.response.substring(0, 50) + '...'
      );
    }
    
    // 测试拦截功能
    const interceptResult = await injector.interceptResponse(
      '✅ 第1段完成\n⚡ 继续第2段...',
      { autoContinueCount: 0 }
    );
    
    this.recordTest(
      '续航拦截 - 触发自动续航',
      interceptResult.autoContinued === true && interceptResult.dryRun === true,
      `触发状态: ${interceptResult.autoContinued}, DryRun: ${interceptResult.dryRun}`,
      '验证拦截器正确触发'
    );
    
    // 测试重试限制
    const maxRetryResult = await injector.interceptResponse(
      '⚡ 继续...',
      { autoContinueCount: 10 }
    );
    
    this.recordTest(
      '续航拦截 - 最大重试限制',
      maxRetryResult.autoContinued === false && maxRetryResult.reason === 'max_retries',
      `原因: ${maxRetryResult.reason}`,
      '超过最大重试次数应停止'
    );
  }
  
  /**
   * 测试2: TODO解析器
   */
  async testTodoParser() {
    this.printSection('第2部分：TODO智能解析器测试');
    
    const parser = new SmartTodoParser({ logEnabled: false });
    
    const testCases = [
      {
        name: 'Markdown格式',
        input: '- [ ] 创建User模型\n- [x] 实现登录\n- [ ] 权限系统',
        expectedCount: 3
      },
      {
        name: '数字列表',
        input: '1. 设计数据库\n2. 实现API\n3. 编写测试',
        expectedCount: 3
      },
      {
        name: '符号列表',
        input: '• 前端优化\n● 后端提升\n○ 文档完善',
        expectedCount: 3
      },
      {
        name: 'Emoji标记',
        input: '✅ 基础开发\n⏳ 测试编写\n🔲 部署上线',
        expectedCount: 3
      },
      {
        name: '中文序号',
        input: '一、需求分析\n二、方案设计\n三、编码实现',
        expectedCount: 3
      },
      {
        name: '关键词触发',
        input: '创建用户系统，实现JWT认证，优化登录流程',
        expectedCount: 3
      },
      {
        name: '混合格式',
        input: '1. 创建模型\n- [ ] User表\n• 实现逻辑\n✅ 环境搭建',
        expectedCount: 4
      },
      {
        name: '智能推断',
        input: '修复登录Bug。优化查询性能。添加日志功能。',
        expectedCount: 3
      }
    ];
    
    for (const testCase of testCases) {
      const todos = parser.parse(testCase.input);
      const pass = todos.length === testCase.expectedCount;
      
      this.recordTest(
        `TODO解析 - ${testCase.name}`,
        pass,
        `预期: ${testCase.expectedCount}个, 实际: ${todos.length}个`,
        testCase.input.substring(0, 40) + '...'
      );
      
      // 验证执行计划生成
      if (todos.length > 0) {
        const plan = parser.generateExecutionPlan(todos);
        this.recordTest(
          `执行计划 - ${testCase.name}`,
          plan.totalTasks === todos.length && plan.microTasks.length > 0,
          `任务数: ${plan.totalTasks}, 微任务批次: ${plan.microTasks.length}`,
          '验证计划生成'
        );
      }
    }
    
    // Token估算测试
    const complexTask = '创建完整的用户认证系统，包括注册、登录、JWT、权限管理';
    const estimatedTokens = parser.estimateTokens(complexTask);
    
    this.recordTest(
      'Token估算 - 复杂任务',
      estimatedTokens > 500 && estimatedTokens < 5000,
      `估算Token: ${estimatedTokens}`,
      '验证Token估算在合理范围'
    );
  }
  
  /**
   * 测试3: MCP集成
   */
  async testMCPIntegration() {
    this.printSection('第3部分：MCP集成测试');
    
    const integration = new MCPIntegration({
      dryRun: true,
      logEnabled: false,
      persistTodos: false
    });
    
    // 场景1: TODO检测
    const userMessage1 = `请完成：
- [ ] 创建User模型
- [ ] 实现API
- [ ] 编写测试`;
    
    const aiResponse1 = '✅ 理解需求，开始执行...';
    
    const result1 = await integration.interceptAIResponse(aiResponse1, {
      userMessage: userMessage1
    });
    
    this.recordTest(
      'MCP集成 - TODO检测',
      result1.todoPlan !== null && result1.todoPlan.totalTasks === 3,
      `检测到TODO计划: ${result1.todoPlan ? result1.todoPlan.totalTasks : 0}个任务`,
      '验证TODO自动检测'
    );
    
    // 场景2: 自动续航触发
    const aiResponse2 = '✅ 第1段完成\n⚡ 继续第2段...';
    
    const result2 = await integration.interceptAIResponse(aiResponse2, {
      autoContinueCount: 0
    });
    
    this.recordTest(
      'MCP集成 - 自动续航',
      result2.autoContinue !== null && result2.autoContinue.autoContinued === true,
      `续航触发: ${result2.autoContinue ? result2.autoContinue.autoContinued : false}`,
      '验证自动续航触发'
    );
    
    // 场景3: 同时检测TODO和续航
    const userMessage3 = '1. 创建模块A\n2. 创建模块B\n3. 测试';
    const aiResponse3 = '✅ 模块A完成\n⚡ 立即开始模块B...';
    
    const result3 = await integration.interceptAIResponse(aiResponse3, {
      userMessage: userMessage3,
      autoContinueCount: 0
    });
    
    this.recordTest(
      'MCP集成 - 双重检测',
      result3.todoPlan !== null && result3.autoContinue !== null,
      `TODO: ${result3.todoPlan ? '✅' : '❌'}, 续航: ${result3.autoContinue ? '✅' : '❌'}`,
      '验证同时检测TODO和续航信号'
    );
    
    // 场景4: 增强响应生成
    this.recordTest(
      'MCP集成 - 响应增强',
      result3.enhancedResponse && result3.enhancedResponse.includes('📋'),
      `增强响应长度: ${result3.enhancedResponse ? result3.enhancedResponse.length : 0}`,
      '验证响应被正确增强'
    );
    
    // 统计数据验证
    const stats = integration.getStats();
    
    this.recordTest(
      'MCP集成 - 统计数据',
      stats.totalInterceptions === 3 && stats.autoContinueTriggered === 2,
      `拦截: ${stats.totalInterceptions}, 续航: ${stats.autoContinueTriggered}`,
      '验证统计数据准确'
    );
  }
  
  /**
   * 测试4: 端到端场景
   */
  async testEndToEndScenarios() {
    this.printSection('第4部分：端到端场景测试');
    
    const integration = new MCPIntegration({
      dryRun: true,
      logEnabled: false,
      persistTodos: false
    });
    
    // 场景A: 完整开发流程模拟
    console.log('\n  场景A: 完整开发流程模拟\n');
    
    const devScenario = [
      {
        user: '创建用户系统：\n1. User模型\n2. 登录API\n3. 权限系统\n4. 测试用例',
        ai: '✅ 理解需求。开始创建User模型...\n[代码内容]\n✅ User模型完成\n⚡ 继续第2个任务（登录API）...'
      },
      {
        user: '继续',
        ai: '[登录API代码]\n✅ 登录API完成\n⚡ 继续第3个任务（权限系统）...'
      },
      {
        user: '继续',
        ai: '[权限代码]\n✅ 权限系统完成\n⚡ 继续第4个任务（测试用例）...'
      },
      {
        user: '继续',
        ai: '[测试代码]\n✅ 全部4个任务完成！'
      }
    ];
    
    let totalAutoContinue = 0;
    
    for (let i = 0; i < devScenario.length; i++) {
      const step = devScenario[i];
      const result = await integration.interceptAIResponse(step.ai, {
        userMessage: step.user,
        autoContinueCount: i
      });
      
      if (result.autoContinue && result.autoContinue.autoContinued) {
        totalAutoContinue++;
      }
    }
    
    this.recordTest(
      'E2E - 完整开发流程',
      totalAutoContinue === 3,
      `自动续航触发次数: ${totalAutoContinue}/3`,
      '验证完整流程的自动续航'
    );
    
    // 场景B: 批量任务处理
    console.log('\n  场景B: 批量任务处理模拟\n');
    
    const batchResults = [];
    for (let i = 1; i <= 5; i++) {
      const aiResponse = `✅ 已完成 ${i * 10}/50 个文件\n⚡ 继续处理第${i * 10 + 1}个...`;
      const result = await integration.interceptAIResponse(aiResponse, {
        autoContinueCount: i - 1
      });
      batchResults.push(result.autoContinue && result.autoContinue.autoContinued);
    }
    
    const batchSuccessCount = batchResults.filter(r => r).length;
    
    this.recordTest(
      'E2E - 批量任务处理',
      batchSuccessCount === 5,
      `批量续航成功: ${batchSuccessCount}/5`,
      '验证批量任务自动续航'
    );
    
    // 场景C: 复杂TODO格式混合
    const complexUserMessage = `项目需求：
【必做】
- [ ] 数据库设计
- [ ] 后端API

【优化】
• 性能提升
• 日志完善

【测试】
1. 单元测试
2. 集成测试`;
    
    const complexResult = await integration.interceptAIResponse(
      '开始执行...',
      { userMessage: complexUserMessage }
    );
    
    this.recordTest(
      'E2E - 复杂TODO格式',
      complexResult.todoPlan && complexResult.todoPlan.totalTasks >= 6,
      `识别任务数: ${complexResult.todoPlan ? complexResult.todoPlan.totalTasks : 0}`,
      '验证复杂格式混合识别'
    );
  }
  
  /**
   * 记录测试结果
   */
  recordTest(name, pass, details, context) {
    this.testResults.push({
      name,
      pass,
      details,
      context
    });
    
    if (pass) {
      this.passCount++;
      console.log(`  ✅ ${name}`);
      console.log(`     ${details}`);
    } else {
      this.failCount++;
      console.log(`  ❌ ${name}`);
      console.log(`     ${details}`);
      console.log(`     上下文: ${context}`);
    }
  }
  
  /**
   * 打印章节
   */
  printSection(title) {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60) + '\n');
  }
  
  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n' + '╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(20) + '测试报告' + ' '.repeat(28) + '║');
    console.log('╚' + '═'.repeat(58) + '╝\n');
    
    const totalTests = this.passCount + this.failCount;
    const passRate = totalTests > 0 ? ((this.passCount / totalTests) * 100).toFixed(1) : 0;
    
    console.log(`📊 测试统计：`);
    console.log(`   总测试数: ${totalTests}`);
    console.log(`   ✅ 通过: ${this.passCount}`);
    console.log(`   ❌ 失败: ${this.failCount}`);
    console.log(`   📈 通过率: ${passRate}%`);
    
    console.log(`\n🎯 质量评估：`);
    if (passRate >= 95) {
      console.log(`   ⭐⭐⭐⭐⭐ 优秀 - 系统运行完美`);
    } else if (passRate >= 80) {
      console.log(`   ⭐⭐⭐⭐ 良好 - 系统基本可用`);
    } else if (passRate >= 60) {
      console.log(`   ⭐⭐⭐ 及格 - 需要优化`);
    } else {
      console.log(`   ⭐⭐ 不及格 - 需要重大修复`);
    }
    
    // 失败测试详情
    if (this.failCount > 0) {
      console.log(`\n❌ 失败测试详情：`);
      this.testResults
        .filter(r => !r.pass)
        .forEach((result, index) => {
          console.log(`\n   ${index + 1}. ${result.name}`);
          console.log(`      详情: ${result.details}`);
          console.log(`      上下文: ${result.context}`);
        });
    }
    
    console.log(`\n💡 建议：`);
    if (passRate >= 95) {
      console.log(`   ✅ 系统可以立即部署`);
      console.log(`   ✅ 执行率预计: 90-95%`);
    } else if (passRate >= 80) {
      console.log(`   ⚠️  修复失败项后可部署`);
      console.log(`   ✅ 执行率预计: 75-85%`);
    } else {
      console.log(`   🔴 需要重大修复后才能部署`);
      console.log(`   ⚠️  执行率预计: <70%`);
    }
    
    console.log('\n' + '═'.repeat(60) + '\n');
    
    // 返回退出码
    process.exit(this.failCount > 0 ? 1 : 0);
  }
}

// 运行测试
if (require.main === module) {
  const tester = new AutoContinueSystemTester();
  tester.runAllTests().catch(error => {
    console.error('\n❌ 测试运行失败:', error);
    process.exit(1);
  });
}

module.exports = AutoContinueSystemTester;


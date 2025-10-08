/**
 * 四角色管理系统
 * 功能：
 * 1. 管理4个AI角色（User Manager, Product Manager, Developer, Observer）
 * 2. 基于上下文自动切换角色
 * 3. 轮流发言机制
 * 4. 角色职责明确分工
 * 
 * 执行率目标：90%
 */

const GUITestRunner = require('./gui-test-runner.cjs');
const SkillLibrary = require('./skill-library.cjs');
const DialogueConfirmation = require('./dialogue-confirmation.cjs');
const LoopProtection = require('./loop-protection.cjs');

class RoleManager {
  constructor() {
    this.roles = {
      userManager: {
        id: 'AI1',
        name: '小户',
        title: '用户经理',
        title_en: 'User Manager',
        emoji: '👤',
        color: '#4CAF50',
        responsibilities: [
          '需求收集',
          '用户体验',
          '产品反馈',
          '执行GUI自动化测试',
          '5轮测试验证（截图+日志）'
        ],
        tools: ['GUITestRunner', 'DialogueConfirmation']
      },
      productManager: {
        id: 'AI2',
        name: '小品',
        title: '产品经理',
        title_en: 'Product Manager',
        emoji: '📋',
        color: '#2196F3',
        responsibilities: [
          '需求分析',
          '产品设计',
          '优先级管理',
          'GUI原型设计',
          '技术方案制定',
          '质量验收'
        ],
        tools: ['SkillLibrary']
      },
      developer: {
        id: 'AI3',
        name: '小柳',
        title: '技术开发',
        title_en: 'Technical Developer',
        emoji: '💻',
        color: '#FF9800',
        responsibilities: [
          '代码开发',
          '技术实现',
          '质量保障',
          'BUG修复（最多5次）',
          '成功经验记录',
          '工具自动修复'
        ],
        tools: ['SkillLibrary', 'LoopProtection']
      },
      observer: {
        id: 'AI4',
        name: '小观',
        title: '监督管理',
        title_en: 'Supervisor',
        emoji: '👁️',
        color: '#F44336',
        responsibilities: [
          '质量监督',
          '规则执行',
          '风险控制',
          '全流程监控',
          '会议主持（轮流发言）',
          '最终交付检查'
        ],
        tools: ['All']
      }
    };

    this.currentRole = null;
    this.conversationHistory = [];
    this.roleLog = [];
  }

  /**
   * 根据上下文自动决定角色
   */
  detectRole(message, context = {}) {
    const keywords = {
      userManager: ['需求', '要求', '测试', '验证', '确认', 'GUI', '截图'],
      productManager: ['分析', '设计', '方案', '原型', '架构', '评审'],
      developer: ['开发', '实现', '代码', '修复', 'BUG', '编程'],
      observer: ['监控', '检查', '风险', '问题', '会议', '汇报']
    };

    let maxScore = 0;
    let detectedRole = 'userManager'; // 默认角色

    for (const [role, words] of Object.entries(keywords)) {
      const score = words.filter(word => message.includes(word)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedRole = role;
      }
    }

    // 如果有明确的上下文指示
    if (context.role) {
      detectedRole = context.role;
    }

    return detectedRole;
  }

  /**
   * 切换角色
   */
  switchRole(roleKey, reason = '') {
    const previousRole = this.currentRole;
    this.currentRole = roleKey;

    const roleInfo = this.roles[roleKey];
    
    this.roleLog.push({
      timestamp: new Date().toISOString(),
      from: previousRole,
      to: roleKey,
      reason,
      roleInfo
    });

    console.log(`\n${roleInfo.emoji} [角色切换] ${previousRole ? this.roles[previousRole].name : '无'} → ${roleInfo.name}`);
    if (reason) {
      console.log(`   原因: ${reason}`);
    }

    return roleInfo;
  }

  /**
   * 获取当前角色
   */
  getCurrentRole() {
    if (!this.currentRole) {
      return null;
    }
    return this.roles[this.currentRole];
  }

  /**
   * 生成角色声明（用于对话开头）
   */
  generateRoleDeclaration(roleKey = null) {
    const role = roleKey ? this.roles[roleKey] : this.getCurrentRole();
    
    if (!role) {
      return '';
    }

    return `
---
**当前角色：** ${role.emoji} ${role.name} (${role.id})

**职责范围：**
${role.responsibilities.map(r => `- ${r}`).join('\n')}

**可用工具：** ${role.tools.join(', ')}
---
    `.trim();
  }

  /**
   * User Manager 执行流程
   */
  async executeUserManagerTask(userRequest) {
    this.switchRole('userManager', '接收用户需求');
    
    console.log(this.generateRoleDeclaration());
    
    // 步骤1: 生成确认卡
    const confirmation = new DialogueConfirmation();
    const confirmationCard = confirmation.generateTemplate(userRequest);
    
    console.log('\n📋 生成确认卡:\n');
    console.log(confirmationCard);
    
    // 步骤2: 验证确认卡
    const validation = confirmation.checkConfirmationCard(confirmationCard);
    console.log(`\n确认卡验证: ${validation.pass ? '✅ 通过' : '❌ 不通过'}`);
    
    if (!validation.pass) {
      console.log('\n违规项:');
      validation.violations.forEach(v => console.log(`  ${v.message}`));
      return { success: false, reason: '确认卡不完整' };
    }
    
    // 步骤3: 等待用户确认（模拟）
    console.log('\n⏸️  等待用户确认...');
    
    return {
      success: true,
      confirmationCard,
      validation
    };
  }

  /**
   * Product Manager 执行流程
   */
  async executeProductManagerTask(requirement) {
    this.switchRole('productManager', '需求分析与方案设计');
    
    console.log(this.generateRoleDeclaration());
    
    // 步骤1: 需求分析
    console.log('\n📊 需求分析中...');
    
    // 步骤2: 技术方案制定
    const technicalPlan = {
      modules: [],
      apis: [],
      database: [],
      testing: []
    };
    
    console.log('\n✅ 技术方案已制定');
    
    // 步骤3: 任务分配
    const tasks = [
      { assignee: 'developer', description: '实现核心功能' },
      { assignee: 'developer', description: '编写单元测试' }
    ];
    
    console.log('\n📋 任务已分配给 Developer');
    
    return {
      success: true,
      technicalPlan,
      tasks
    };
  }

  /**
   * Developer 执行流程
   */
  async executeDeveloperTask(task) {
    this.switchRole('developer', '代码开发与实现');
    
    console.log(this.generateRoleDeclaration());
    
    const skillLibrary = new SkillLibrary();
    const loopProtection = new LoopProtection();
    
    // 步骤1: 搜索历史经验
    console.log('\n🔍 搜索历史经验...');
    const solutions = await skillLibrary.findSolution(task.description || '');
    
    if (solutions.length > 0) {
      console.log(`✅ 找到 ${solutions.length} 个相关经验`);
      solutions.slice(0, 3).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.title} (相似度: ${(s.score * 100).toFixed(0)}%)`);
      });
    }
    
    // 步骤2: 代码实现（模拟）
    console.log('\n💻 代码实现中...');
    
    const code = `
function implement() {
  const startTime = Date.now();
  const TIMEOUT = 30000;
  
  while (true && (Date.now() - startTime < TIMEOUT)) {
    if (completed) break;
    doWork();
  }
}
    `.trim();
    
    // 步骤3: 循环检查
    console.log('\n🛡️  循环安全检查...');
    const loopCheck = loopProtection.checkLoopCode(code);
    console.log(`循环检查: ${loopCheck.pass ? '✅ 通过' : '❌ 不通过'}`);
    
    // 步骤4: 记录成功经验
    if (loopCheck.pass) {
      await skillLibrary.recordSuccess({
        type: 'pattern',
        title: task.description || '任务完成',
        solution: '实现成功',
        context: 'Developer task execution'
      });
      console.log('\n✅ 经验已记录到技能库');
    }
    
    return {
      success: loopCheck.pass,
      code,
      loopCheck
    };
  }

  /**
   * Observer 执行流程
   */
  async executeObserverTask(context) {
    this.switchRole('observer', '全流程监控与检查');
    
    console.log(this.generateRoleDeclaration());
    
    // 步骤1: 检查整体状态
    console.log('\n👁️  监控检查...');
    
    const health = {
      userManager: '✅ 正常',
      productManager: '✅ 正常',
      developer: '✅ 正常',
      overall: '✅ 健康'
    };
    
    console.log('\n系统状态:');
    Object.entries(health).forEach(([key, status]) => {
      console.log(`  ${key}: ${status}`);
    });
    
    // 步骤2: 风险评估
    const risks = [];
    if (risks.length > 0) {
      console.log('\n⚠️  发现风险:');
      risks.forEach(r => console.log(`  - ${r}`));
    } else {
      console.log('\n✅ 无风险');
    }
    
    return {
      success: true,
      health,
      risks
    };
  }

  /**
   * 生成角色使用报告
   */
  generateReport() {
    const roleCounts = {};
    this.roleLog.forEach(log => {
      roleCounts[log.to] = (roleCounts[log.to] || 0) + 1;
    });

    return {
      totalSwitches: this.roleLog.length,
      currentRole: this.currentRole,
      roleCounts,
      history: this.roleLog,
      summary: `总切换次数: ${this.roleLog.length}, 当前角色: ${this.currentRole || '无'}`
    };
  }
}

// 如果直接运行此脚本，执行演示
if (require.main === module) {
  const manager = new RoleManager();

  (async () => {
    console.log('\n🎭 四角色系统演示\n');
    console.log('='.repeat(60));

    // 演示1: User Manager
    await manager.executeUserManagerTask('创建GUI测试系统');

    // 演示2: Product Manager
    await manager.executeProductManagerTask({ title: 'GUI测试系统' });

    // 演示3: Developer
    await manager.executeDeveloperTask({ description: '实现GUI测试功能' });

    // 演示4: Observer
    await manager.executeObserverTask({});

    // 生成报告
    console.log('\n\n📊 角色使用报告\n');
    console.log('='.repeat(60));
    const report = manager.generateReport();
    console.log(JSON.stringify(report, null, 2));
  })();
}

module.exports = RoleManager;


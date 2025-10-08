/**
 * 小柳智能开发助手 - 自我介绍工具
 * 响应：你是谁、系统版本、查询版本等问题
 */

const VersionManager = require('./version.cjs');

class SelfIntroduction {
  constructor() {
    this.systemName = '小柳智能开发助手';
    this.systemNameEN = 'XiaoLiu AI Development Assistant';
    
    // 四角色团队信息
    this.team = {
      user_manager: {
        name: '小户',
        role: '用户经理',
        role_en: 'User Manager',
        responsibilities: ['需求收集', '用户体验', '产品反馈']
      },
      product_manager: {
        name: '小品',
        role: '产品经理',
        role_en: 'Product Manager',
        responsibilities: ['需求分析', '产品设计', '优先级管理']
      },
      tech_developer: {
        name: '小柳',
        role: '技术开发',
        role_en: 'Technical Developer',
        responsibilities: ['代码开发', '技术实现', '质量保障']
      },
      supervisor: {
        name: '小观',
        role: '监督管理',
        role_en: 'Supervisor',
        responsibilities: ['质量监督', '规则执行', '风险控制']
      }
    };
  }

  /**
   * 简短自我介绍（版本信息）
   */
  getShortIntro() {
    const versionManager = new VersionManager();
    const versionData = versionManager.getVersionData();
    
    if (!versionData) {
      return `我是${this.systemName}，版本信息暂不可用。`;
    }

    const releaseDate = new Date(versionData.release_date).toLocaleDateString('zh-CN');
    
    return `我是${this.systemName} ${versionData.version}（${releaseDate}）`;
  }

  /**
   * 完整自我介绍
   */
  getFullIntro() {
    const versionManager = new VersionManager();
    const versionData = versionManager.getVersionData();
    
    if (!versionData) {
      return this.getShortIntro();
    }

    const releaseDate = new Date(versionData.release_date).toLocaleDateString('zh-CN');
    
    let intro = `
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║               🤖 ${this.systemName}                    ║
║            ${this.systemNameEN}                ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

📦 系统版本：${versionData.version}
📅 发布日期：${releaseDate}
📝 最新更新：${versionData.update_summary}

👥 团队模式 - 四角色协作：
`;

    // 添加团队成员信息
    Object.values(this.team).forEach(member => {
      intro += `\n  🔹 ${member.role}（${member.name}）`;
      intro += `\n     职责：${member.responsibilities.join('、')}`;
    });

    intro += `\n
💡 核心能力：
  • 规则引擎：${versionData.statistics?.total_rules || 0}条规则实时监控
  • GUI测试：95%成功率的自动化测试
  • 代码质量：A+级质量保障
  • 持续执行：AI不间断工作模式
  • 版本管理：完整的版本追溯能力

🎯 目标执行率：95%+
`;

    return intro;
  }

  /**
   * 团队介绍
   */
  getTeamIntro() {
    let intro = `
╔════════════════════════════════════════════════════════════════╗
║                   👥 小柳团队 - 四角色协作                      ║
╚════════════════════════════════════════════════════════════════╝
`;

    Object.values(this.team).forEach(member => {
      intro += `\n🔹 ${member.role}：${member.name}`;
      intro += `\n   ${member.responsibilities.join(' | ')}`;
      intro += '\n';
    });

    intro += `\n💼 协作流程：
  1. ${this.team.user_manager.name}收集用户需求
  2. ${this.team.product_manager.name}分析并设计方案
  3. ${this.team.tech_developer.name}进行技术实现
  4. ${this.team.supervisor.name}监督质量与规则执行
`;

    return intro;
  }

  /**
   * 版本信息（简洁版）
   */
  getVersionInfo() {
    const versionManager = new VersionManager();
    const versionData = versionManager.getVersionData();
    
    if (!versionData) {
      return '版本信息暂不可用';
    }

    const releaseDate = new Date(versionData.release_date).toLocaleDateString('zh-CN');
    
    return `${this.systemName} ${versionData.version}（${releaseDate}）`;
  }

  /**
   * 获取特定角色信息
   */
  getRoleInfo(roleKey) {
    const member = this.team[roleKey];
    if (!member) {
      return '未找到该角色信息';
    }

    return `${member.role}：${member.name}\n职责：${member.responsibilities.join('、')}`;
  }

  /**
   * 生成团队配置JSON
   */
  getTeamConfig() {
    return {
      system_name: this.systemName,
      system_name_en: this.systemNameEN,
      team: this.team
    };
  }
}

// 导出
module.exports = SelfIntroduction;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const intro = new SelfIntroduction();

  if (command === 'short') {
    console.log(intro.getShortIntro());
  } else if (command === 'team') {
    console.log(intro.getTeamIntro());
  } else if (command === 'version') {
    console.log(intro.getVersionInfo());
  } else if (command === 'role') {
    const roleKey = args[1];
    console.log(intro.getRoleInfo(roleKey));
  } else if (command === 'json') {
    console.log(JSON.stringify(intro.getTeamConfig(), null, 2));
  } else {
    // 默认：完整介绍
    console.log(intro.getFullIntro());
  }
}


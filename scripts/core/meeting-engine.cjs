/**
 * 会议引擎（四角色轮流发言）
 * 功能：
 * 1. 触发四角色会议
 * 2. 轮流发言机制
 * 3. 汇总意见形成决议
 * 4. 会议记录保存
 * 
 * 执行率目标：65%
 */

const fs = require('fs').promises;
const path = require('path');

class MeetingEngine {
  constructor() {
    this.meetingLog = [];
    this.currentMeeting = null;
    this.logsDir = path.join(__dirname, '../../logs/meetings');
  }

  /**
   * 触发会议
   */
  async triggerMeeting(issue) {
    console.log(`\n🎪 [会议触发] ${issue.title || '未命名问题'}`);
    console.log(`   严重程度: ${issue.severity || '中'}`);
    console.log(`   触发原因: ${issue.reason || '未知'}\n`);

    this.currentMeeting = {
      id: `MTG-${Date.now()}`,
      title: issue.title,
      severity: issue.severity || 'medium',
      reason: issue.reason,
      startTime: new Date().toISOString(),
      participants: ['userManager', 'productManager', 'developer', 'observer'],
      speeches: [],
      resolution: null,
      status: 'in_progress'
    };

    // 轮流发言
    await this.conductRoundRobinDiscussion(issue);

    // Observer 汇总意见
    const resolution = await this.summarizeAndResolve();

    // 保存会议记录
    await this.saveMeetingLog();

    this.currentMeeting.status = 'completed';
    this.currentMeeting.endTime = new Date().toISOString();

    console.log(`\n✅ [会议结束] 决议已形成\n`);

    return {
      meetingId: this.currentMeeting.id,
      resolution,
      duration: Date.now() - new Date(this.currentMeeting.startTime).getTime()
    };
  }

  /**
   * 轮流发言机制
   */
  async conductRoundRobinDiscussion(issue) {
    const roles = [
      {
        key: 'userManager',
        name: 'User Manager',
        emoji: '👤',
        perspective: '用户角度'
      },
      {
        key: 'productManager',
        name: 'Product Manager',
        emoji: '📊',
        perspective: '产品角度'
      },
      {
        key: 'developer',
        name: 'Developer',
        emoji: '💻',
        perspective: '技术角度'
      },
      {
        key: 'observer',
        name: 'Observer',
        emoji: '👁️',
        perspective: '整体角度'
      }
    ];

    console.log('='.repeat(70));
    console.log('开始轮流发言...\n');

    for (const role of roles) {
      const speech = await this.generateSpeech(role, issue);
      this.currentMeeting.speeches.push(speech);

      console.log(`${role.emoji} [${role.name}] (${role.perspective}):`);
      console.log(`   ${speech.content}\n`);

      // 模拟思考时间
      await this.delay(500);
    }

    console.log('='.repeat(70));
  }

  /**
   * 生成发言内容
   */
  async generateSpeech(role, issue) {
    const speech = {
      role: role.key,
      roleName: role.name,
      perspective: role.perspective,
      timestamp: new Date().toISOString(),
      content: ''
    };

    // 根据角色生成不同的发言内容
    switch (role.key) {
      case 'userManager':
        speech.content = `从用户角度看，${issue.title}会影响用户体验。建议优先考虑用户需求，确保功能稳定可靠。`;
        break;

      case 'productManager':
        speech.content = `从产品角度分析，需要评估${issue.title}的影响范围和优先级。建议制定详细的解决方案和时间表。`;
        break;

      case 'developer':
        speech.content = `从技术角度来看，${issue.title}可能需要重构部分代码。建议先搜索技能库查找类似问题的解决方案。`;
        break;

      case 'observer':
        speech.content = `从整体监控角度，${issue.title}的严重程度为${issue.severity}。需要权衡各方意见，形成可执行的决议。`;
        break;
    }

    return speech;
  }

  /**
   * Observer 汇总意见并形成决议
   */
  async summarizeAndResolve() {
    console.log(`\n👁️  [Observer 汇总意见]\n`);

    const resolution = {
      summary: '',
      action: '',
      assignee: '',
      priority: '',
      deadline: ''
    };

    // 分析所有发言
    const allContent = this.currentMeeting.speeches.map(s => s.content).join(' ');

    // 确定优先级
    if (this.currentMeeting.severity === 'high' || allContent.includes('紧急') || allContent.includes('优先')) {
      resolution.priority = 'P0';
    } else if (this.currentMeeting.severity === 'medium') {
      resolution.priority = 'P1';
    } else {
      resolution.priority = 'P2';
    }

    // 确定执行人
    if (allContent.includes('技术') || allContent.includes('代码') || allContent.includes('重构')) {
      resolution.assignee = 'Developer';
    } else if (allContent.includes('方案') || allContent.includes('设计')) {
      resolution.assignee = 'Product Manager';
    } else {
      resolution.assignee = 'User Manager';
    }

    // 生成决议
    resolution.summary = `经四角色讨论，${this.currentMeeting.title}需要${resolution.assignee}负责处理`;
    resolution.action = `1. 搜索技能库查找解决方案\n2. 实施修复\n3. 进行5轮测试验证\n4. 记录成功经验`;
    resolution.deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 明天

    this.currentMeeting.resolution = resolution;

    console.log(`📋 决议内容:`);
    console.log(`   优先级: ${resolution.priority}`);
    console.log(`   负责人: ${resolution.assignee}`);
    console.log(`   截止日期: ${resolution.deadline}`);
    console.log(`   行动计划:\n   ${resolution.action.replace(/\n/g, '\n   ')}`);

    return resolution;
  }

  /**
   * 保存会议记录
   */
  async saveMeetingLog() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });

      const filename = `meeting_${this.currentMeeting.id}.json`;
      const filepath = path.join(this.logsDir, filename);

      await fs.writeFile(
        filepath,
        JSON.stringify(this.currentMeeting, null, 2),
        'utf8'
      );

      console.log(`\n💾 会议记录已保存: ${filename}`);

      // 同时生成Markdown格式报告
      const mdReport = this.generateMarkdownReport();
      const mdFilepath = path.join(this.logsDir, `meeting_${this.currentMeeting.id}.md`);
      await fs.writeFile(mdFilepath, mdReport, 'utf8');

      this.meetingLog.push(this.currentMeeting);

    } catch (error) {
      console.error('保存会议记录失败:', error.message);
    }
  }

  /**
   * 生成Markdown格式会议报告
   */
  generateMarkdownReport() {
    const meeting = this.currentMeeting;
    const duration = meeting.endTime 
      ? ((new Date(meeting.endTime) - new Date(meeting.startTime)) / 1000).toFixed(2)
      : '进行中';

    return `# 会议记录：${meeting.title}

**会议ID：** ${meeting.id}  
**严重程度：** ${meeting.severity}  
**触发原因：** ${meeting.reason}  
**开始时间：** ${meeting.startTime}  
**结束时间：** ${meeting.endTime || '进行中'}  
**会议时长：** ${duration}秒

---

## 参会人员

${meeting.participants.map(p => `- ${p}`).join('\n')}

---

## 发言记录

${meeting.speeches.map((s, i) => `
### ${i + 1}. ${s.roleName} (${s.perspective})

**发言时间：** ${s.timestamp}

${s.content}
`).join('\n')}

---

## 决议

${meeting.resolution ? `
**优先级：** ${meeting.resolution.priority}  
**负责人：** ${meeting.resolution.assignee}  
**截止日期：** ${meeting.resolution.deadline}

### 行动计划

${meeting.resolution.action}

### 总结

${meeting.resolution.summary}
` : '暂无决议'}

---

**会议状态：** ${meeting.status}
    `.trim();
  }

  /**
   * 获取会议历史
   */
  getMeetingHistory() {
    return this.meetingLog;
  }

  /**
   * 获取会议统计
   */
  getStatistics() {
    return {
      totalMeetings: this.meetingLog.length,
      severityDistribution: this.getSeverityDistribution(),
      averageDuration: this.getAverageDuration(),
      resolutionRate: this.getResolutionRate()
    };
  }

  getSeverityDistribution() {
    const dist = { high: 0, medium: 0, low: 0 };
    this.meetingLog.forEach(m => {
      dist[m.severity] = (dist[m.severity] || 0) + 1;
    });
    return dist;
  }

  getAverageDuration() {
    if (this.meetingLog.length === 0) return 0;
    
    const totalDuration = this.meetingLog.reduce((sum, m) => {
      if (m.endTime) {
        return sum + (new Date(m.endTime) - new Date(m.startTime));
      }
      return sum;
    }, 0);

    return (totalDuration / this.meetingLog.length / 1000).toFixed(2);
  }

  getResolutionRate() {
    if (this.meetingLog.length === 0) return 0;
    
    const resolved = this.meetingLog.filter(m => m.resolution).length;
    return ((resolved / this.meetingLog.length) * 100).toFixed(2);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 如果直接运行此脚本，执行演示
if (require.main === module) {
  const engine = new MeetingEngine();

  (async () => {
    // 测试会议1
    await engine.triggerMeeting({
      title: 'BUG修复失败5次',
      severity: 'high',
      reason: '尝试了5种方法都无法解决此BUG'
    });

    console.log('\n\n' + '='.repeat(70) + '\n');

    // 测试会议2
    await engine.triggerMeeting({
      title: 'GUI测试超时',
      severity: 'medium',
      reason: '5轮测试中第3轮超过10分钟'
    });

    // 显示统计
    console.log('\n\n📊 会议统计:\n');
    const stats = engine.getStatistics();
    console.log(JSON.stringify(stats, null, 2));
  })();
}

module.exports = MeetingEngine;


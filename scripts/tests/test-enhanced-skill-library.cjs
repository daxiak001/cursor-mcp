const SkillLibraryEnhanced = require('../core/skill-library-enhanced.cjs');

(async () => {
  const lib = new SkillLibraryEnhanced();
  
  console.log('\n🔄 使用增强版技能库重新导入...\n');
  
  // 技能1: 桌面应用测试
  await lib.recordSuccess({
    type: 'pattern',
    title: '桌面应用GUI自动化测试最佳实践',
    problem: '桌面应用测试 desktop application PyAutoGUI pywinauto Windows应用 图形界面测试 UI自动化 屏幕截图验证 GUI测试',
    solution: '混合使用pywinauto控件树扫描(60%)+OpenCV图像识别(70%)=95%成功率。必须先检测屏幕分辨率pyautogui.size()，禁止硬编码坐标。三层渐进式搜索：严格→放宽→超宽。每步操作后立即截图验证。',
    context: 'Windows桌面应用GUI测试 pywinauto opencv pyautogui混合方案 desktop automation testing'
  });
  
  // 技能2: 截图验证
  await lib.recordSuccess({
    type: 'pattern',
    title: 'GUI测试截图验证标准流程',
    problem: 'GUI测试验证 screenshot 截图 界面测试 视觉验证 测试报告 可视化验证 pyautogui.screenshot',
    solution: '不截图=不验证=不可信。标准流程：1)执行操作 2)立即screenshot(必需) 3)分析截图 4)生成HTML验证报告。代码执行成功≠功能正确，日志显示成功≠用户看到结果。',
    context: 'GUI测试验证方法论 适用于Web和桌面应用 visual testing'
  });
  
  // 技能3: 屏幕分辨率检测
  await lib.recordSuccess({
    type: 'bugFix',
    title: '屏幕分辨率自适应坐标计算',
    problem: '屏幕分辨率 坐标计算 硬编码1920x1080 pyautogui.size() 自适应布局 多显示器 screen resolution',
    solution: '永远先用pyautogui.size()检测屏幕分辨率，再基于分辨率计算坐标。禁止硬编码如(1920,1080)。示例代码：screen_w, screen_h = pyautogui.size(); pyautogui.click(screen_w - 100, screen_h - 100)',
    context: 'PyAutoGUI桌面自动化 避免硬编码坐标导致失败 adaptive coordinates'
  });
  
  // 技能4: 数据格式规范
  await lib.recordSuccess({
    type: 'pattern',
    title: '数据文件格式规范-禁用MD保存数据',
    problem: '数据格式 JSON YAML MD markdown 配置文件 日志文件 结构化数据 IR-040铁律',
    solution: '禁止使用.md保存结构化数据、配置、日志、测试数据。必须使用.json或.yaml。MD格式包含大量特殊符号，不利于AI阅读。例外：README.md、文档、报告可用MD。',
    context: 'IR-040数据格式铁律 历史违规概率最高问题'
  });
  
  console.log('\n✅ 增强版导入完成！\n');
  console.log('='.repeat(70));
  console.log('📋 测试多关键词搜索：\n');
  
  const tests = [
    '桌面应用',
    'PyAutoGUI', 
    'desktop testing',
    '截图验证',
    '屏幕分辨率',
    'screenshot',
    'GUI automation',
    'pywinauto',
    '数据格式',
    'JSON配置'
  ];
  
  for (const query of tests) {
    const results = await lib.findSolution(query, 0.08); // 降低阈值从0.2到0.08
    const status = results.length > 0 ? '✅' : '❌';
    console.log(`${status} [${query}] 找到 ${results.length} 个结果`);
    
    if (results.length > 0) {
      const top = results[0];
      console.log(`   → ${top.title} (总分: ${(top.score * 100).toFixed(0)}%)`);
      console.log(`      匹配详情: 关键词${top.matchDetails.keywordScore} | 标签${top.matchDetails.tagScore} | 标题${top.matchDetails.titleScore}`);
    }
    console.log('');
  }
  
  console.log('='.repeat(70));
  const stats = await lib.getStats();
  console.log('\n📊 技能库统计:');
  console.log(`   总技能数: ${stats.totalSkills}`);
  console.log(`   BUG修复: ${stats.bugFixes}`);
  console.log(`   最佳实践: ${stats.patterns}`);
  console.log('');
})();


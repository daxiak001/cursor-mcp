/**
 * 技能库数据迁移工具
 * 为旧数据添加keywords字段并重建索引
 */

const SkillLibraryEnhanced = require('../core/skill-library-enhanced.cjs');

(async () => {
  console.log('\n🔄 开始技能库数据迁移...\n');
  
  const lib = new SkillLibraryEnhanced();
  await lib.load();
  
  let migrated = 0;
  
  // 迁移所有类别
  for (const category of ['bugFixes', 'tools', 'patterns', 'failures']) {
    for (const skill of lib.skills[category]) {
      // 如果没有keywords字段，重新生成
      if (!skill.keywords || skill.keywords.length === 0) {
        skill.keywords = lib.extractKeywords(skill.title + ' ' + skill.problem + ' ' + skill.solution);
        skill.tags = lib.extractTags(skill.title + ' ' + skill.problem + ' ' + skill.solution + ' ' + (skill.context || ''));
        migrated++;
        console.log(`✅ 已迁移: ${skill.title}`);
        console.log(`   Keywords: ${skill.keywords.slice(0, 10).join(', ')}...`);
        console.log(`   Tags: ${skill.tags.join(', ')}`);
        console.log('');
      }
    }
  }
  
  if (migrated > 0) {
    await lib.save();
    console.log(`\n🎉 迁移完成！共更新 ${migrated} 条技能\n`);
  } else {
    console.log('\n✅ 所有技能已是最新格式，无需迁移\n');
  }
  
  // 验证搜索
  console.log('='.repeat(70));
  console.log('🔍 验证搜索功能:\n');
  
  const tests = ['桌面应用', 'PyAutoGUI', 'screenshot', 'GUI'];
  
  for (const query of tests) {
    const results = await lib.findSolution(query, 0.2);
    console.log(`[${query}] ${results.length > 0 ? '✅' : '❌'} 找到 ${results.length} 个结果`);
    if (results.length > 0) {
      console.log(`   → ${results[0].title} (${(results[0].score * 100).toFixed(0)}%)`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
})();


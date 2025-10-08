/**
 * SQLite集成测试脚本
 * 功能: 测试数据访问层和规则引擎集成
 */

const { getDB } = require('./db-access.cjs');

async function runTests() {
  console.log('🧪 开始SQLite集成测试\n');
  
  let db;
  let passed = 0;
  let failed = 0;
  
  try {
    // ==================== 测试1: 数据库连接 ====================
    console.log('📌 测试1: 数据库连接');
    db = await getDB();
    console.log('✅ 数据库连接成功\n');
    passed++;
    
    // ==================== 测试2: 规则查询 ====================
    console.log('📌 测试2: 规则查询');
    const allRules = db.getAllRules();
    console.log(`   规则总数: ${allRules.length}`);
    
    const codeRules = db.getAllRules('code');
    console.log(`   代码规则: ${codeRules.length}条`);
    
    const dialogueRules = db.getAllRules('dialogue');
    console.log(`   对话规则: ${dialogueRules.length}条`);
    
    if (allRules.length > 0) {
      console.log('✅ 规则查询成功\n');
      passed++;
    } else {
      console.log('❌ 规则查询失败: 无规则数据\n');
      failed++;
    }
    
    // ==================== 测试3: 单个规则查询 ====================
    console.log('📌 测试3: 单个规则查询');
    const rule = db.getRuleById('IR-003');
    if (rule) {
      console.log(`   规则ID: ${rule.id}`);
      console.log(`   标题: ${rule.title}`);
      console.log(`   类别: ${rule.category}`);
      console.log(`   优先级: ${rule.priority}`);
      console.log('✅ 单规则查询成功\n');
      passed++;
    } else {
      console.log('❌ 规则IR-003不存在\n');
      failed++;
    }
    
    // ==================== 测试4: 规则类型查询 ====================
    console.log('📌 测试4: 规则类型查询');
    const hardcodeRules = db.getRulesByType('hardcode');
    console.log(`   hardcode类型规则: ${hardcodeRules.length}条`);
    
    if (hardcodeRules.length > 0) {
      console.log('✅ 类型查询成功\n');
      passed++;
    } else {
      console.log('❌ 类型查询失败\n');
      failed++;
    }
    
    // ==================== 测试5: 创建任务 ====================
    console.log('📌 测试5: 创建任务');
    const taskId = `TASK-TEST-${Date.now()}`;
    db.createTask({
      id: taskId,
      title: '测试任务',
      description: 'SQLite集成测试任务',
      state: 'new',
      rule_ids: JSON.stringify(['IR-003', 'SIL-003']),
      changed_by: 'test-script'
    });
    
    const task = db.getTaskById(taskId);
    if (task && task.id === taskId) {
      console.log(`   任务ID: ${task.id}`);
      console.log(`   任务状态: ${task.state}`);
      console.log('✅ 任务创建成功\n');
      passed++;
    } else {
      console.log('❌ 任务创建失败\n');
      failed++;
    }
    
    // ==================== 测试6: 更新任务状态 ====================
    console.log('📌 测试6: 更新任务状态');
    db.updateTaskState(taskId, 'in_dev', 'test-script', '开始开发');
    
    const updatedTask = db.getTaskById(taskId);
    if (updatedTask.state === 'in_dev') {
      console.log(`   新状态: ${updatedTask.state}`);
      console.log(`   变更原因: ${updatedTask.change_reason}`);
      console.log('✅ 任务状态更新成功\n');
      passed++;
    } else {
      console.log('❌ 任务状态更新失败\n');
      failed++;
    }
    
    // ==================== 测试7: 审计日志 ====================
    console.log('📌 测试7: 审计日志');
    db.logAudit({
      task_id: taskId,
      rule_id: 'IR-003',
      action: 'check',
      actor: 'test-script',
      target: 'test-code.js',
      result: JSON.stringify({ violations: 0 }),
      severity: 'info',
      duration: 50
    });
    
    const logs = db.getAuditLogs({ task_id: taskId });
    if (logs.length > 0) {
      console.log(`   日志数量: ${logs.length}`);
      console.log(`   最新日志: ${logs[0].action} - ${logs[0].target}`);
      console.log('✅ 审计日志记录成功\n');
      passed++;
    } else {
      console.log('❌ 审计日志记录失败\n');
      failed++;
    }
    
    // ==================== 测试8: 经验库 ====================
    console.log('📌 测试8: 经验库');
    const lessonId = `LESSON-TEST-${Date.now()}`;
    db.createLesson({
      id: lessonId,
      type: 'success',
      problem: '如何集成SQLite到Express',
      solution: '使用sql.js作为轻量级SQLite驱动',
      context: JSON.stringify({ environment: 'Node.js' }),
      tags: JSON.stringify(['database', 'express', 'integration'])
    });
    
    const lessons = db.searchLessons('SQLite', 'success');
    if (lessons.length > 0) {
      console.log(`   搜索结果: ${lessons.length}条`);
      console.log(`   最新经验: ${lessons[0].problem}`);
      console.log('✅ 经验库功能正常\n');
      passed++;
    } else {
      console.log('❌ 经验库功能失败\n');
      failed++;
    }
    
    // ==================== 测试9: 配置管理 ====================
    console.log('📌 测试9: 配置管理');
    db.setConfig('test_key', 'test_value', 'string', '测试配置');
    db.setConfig('test_number', 123, 'number', '测试数字');
    db.setConfig('test_bool', true, 'boolean', '测试布尔');
    
    const strValue = db.getConfig('test_key');
    const numValue = db.getConfig('test_number');
    const boolValue = db.getConfig('test_bool');
    
    if (strValue === 'test_value' && numValue === 123 && boolValue === true) {
      console.log(`   字符串配置: ${strValue} (${typeof strValue})`);
      console.log(`   数字配置: ${numValue} (${typeof numValue})`);
      console.log(`   布尔配置: ${boolValue} (${typeof boolValue})`);
      console.log('✅ 配置管理功能正常\n');
      passed++;
    } else {
      console.log('❌ 配置管理功能失败\n');
      failed++;
    }
    
    // ==================== 测试10: 原始SQL执行 ====================
    console.log('📌 测试10: 原始SQL执行');
    const stats = db.exec(`
      SELECT category, COUNT(*) as count 
      FROM rules 
      WHERE enabled = 1 
      GROUP BY category
    `);
    
    if (stats.length > 0) {
      console.log(`   统计结果:`);
      stats.forEach(s => console.log(`     - ${s.category}: ${s.count}条`));
      console.log('✅ 原始SQL执行正常\n');
      passed++;
    } else {
      console.log('❌ 原始SQL执行失败\n');
      failed++;
    }
    
  } catch (error) {
    console.error('❌ 测试异常:', error.message);
    console.error(error.stack);
    failed++;
  } finally {
    if (db) {
      db.close();
    }
  }
  
  // ==================== 测试总结 ====================
  console.log('━'.repeat(50));
  console.log(`\n📊 测试总结:`);
  console.log(`   ✅ 通过: ${passed}/10`);
  console.log(`   ❌ 失败: ${failed}/10`);
  console.log(`   成功率: ${Math.round((passed / 10) * 100)}%\n`);
  
  if (failed === 0) {
    console.log('🎉 所有测试通过！SQLite集成成功！\n');
    process.exit(0);
  } else {
    console.log('⚠️  部分测试失败，请检查日志\n');
    process.exit(1);
  }
}

runTests();


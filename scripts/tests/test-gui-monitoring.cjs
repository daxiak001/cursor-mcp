/**
 * GUI测试监测功能验证脚本
 * 测试监测系统是否正确记录GUI测试执行情况
 */

const GUITestRunner = require('../core/gui-test-runner.cjs');
const fs = require('fs');
const path = require('path');

console.log('🧪 测试GUI测试监测功能\n');

// 创建一个简单的测试配置（不需要实际浏览器）
const mockTestConfig = {
  name: 'GUI监测功能测试',
  type: 'web',
  url: 'https://example.com',
  headless: true,
  steps: [
    { action: 'wait', duration: 100 },
    { action: 'wait', duration: 100 }
  ]
};

async function testMonitoring() {
  const startTime = Date.now();
  
  console.log('📊 步骤1: 检查监测日志文件是否存在');
  const logFile = path.join(__dirname, '../logs/monitor.log');
  
  if (!fs.existsSync(logFile)) {
    console.log('⚠️  监测日志文件不存在，将在测试后创建');
  } else {
    console.log('✅ 监测日志文件存在');
  }
  
  console.log('\n📊 步骤2: 读取当前日志行数');
  let beforeLines = 0;
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    beforeLines = content.split('\n').filter(l => l.trim()).length;
    console.log(`   当前日志行数: ${beforeLines}`);
  }
  
  console.log('\n📊 步骤3: 执行模拟GUI测试（会失败，因为没有浏览器）');
  console.log('   这是正常的，我们只是测试监测功能是否记录了执行信息\n');
  
  const runner = new GUITestRunner();
  
  try {
    await runner.run5RoundsTest(mockTestConfig);
  } catch (error) {
    console.log(`\n✅ 预期的测试失败: ${error.message.substring(0, 80)}...`);
  }
  
  console.log('\n📊 步骤4: 检查监测日志是否增加');
  
  // 等待日志写入
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (!fs.existsSync(logFile)) {
    console.log('❌ 监测日志文件仍然不存在！');
    return false;
  }
  
  const afterContent = fs.readFileSync(logFile, 'utf8');
  const afterLines = afterContent.split('\n').filter(l => l.trim()).length;
  const newLines = afterLines - beforeLines;
  
  console.log(`   测试后日志行数: ${afterLines}`);
  console.log(`   新增日志行数: ${newLines}`);
  
  if (newLines === 0) {
    console.log('❌ 没有新增监测日志！');
    return false;
  }
  
  console.log('\n📊 步骤5: 检查日志内容');
  
  const recentLogs = afterContent.split('\n')
    .filter(l => l.trim())
    .slice(-newLines);
  
  let foundTestStart = false;
  let foundTestComplete = false;
  let foundError = false;
  
  for (const line of recentLogs) {
    try {
      const log = JSON.parse(line);
      
      if (log.type === 'gui_test_start') {
        foundTestStart = true;
        console.log(`   ✅ 发现测试开始记录: ${log.testName}`);
      }
      
      if (log.type === 'gui_test_complete') {
        foundTestComplete = true;
        console.log(`   ✅ 发现测试完成记录: pass=${log.pass}, duration=${log.duration}ms`);
      }
      
      if (log.type === 'error' && log.source === 'gui-test-runner') {
        foundError = true;
        console.log(`   ✅ 发现错误记录: ${log.error.message.substring(0, 60)}...`);
      }
    } catch (e) {
      // 忽略解析错误
    }
  }
  
  console.log('\n📊 步骤6: 验证监测完整性');
  
  const checks = [
    { name: '测试开始记录 (gui_test_start)', found: foundTestStart },
    { name: '测试完成记录 (gui_test_complete)', found: foundTestComplete },
    { name: '错误记录 (error)', found: foundError }
  ];
  
  let passedChecks = 0;
  
  for (const check of checks) {
    if (check.found) {
      console.log(`   ✅ ${check.name}`);
      passedChecks++;
    } else {
      console.log(`   ❌ ${check.name} - 未找到`);
    }
  }
  
  const duration = Date.now() - startTime;
  
  console.log('\n========================================');
  console.log('📊 监测功能测试结果');
  console.log('========================================');
  console.log(`新增日志行数: ${newLines}`);
  console.log(`验证项通过: ${passedChecks}/${checks.length}`);
  console.log(`测试耗时: ${duration}ms`);
  console.log('========================================\n');
  
  if (passedChecks === checks.length) {
    console.log('🎉 GUI测试监测功能验证成功！');
    console.log('✅ 监测系统正确记录了GUI测试的执行情况\n');
    return true;
  } else {
    console.log('⚠️  部分监测功能未通过验证');
    console.log(`通过率: ${(passedChecks / checks.length * 100).toFixed(1)}%\n`);
    return false;
  }
}

// 运行测试
testMonitoring()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ 测试脚本异常:', error.message);
    process.exit(1);
  });


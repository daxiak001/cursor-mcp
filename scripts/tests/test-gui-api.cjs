/**
 * GUI测试API测试脚本
 */

async function testGUIAPI() {
  console.log('\n========== GUI测试API测试 ==========\n');
  
  const baseUrl = 'http://localhost:3000';
  
  // 测试1: 获取GUI测试规则
  console.log('测试1: 获取GUI测试规则');
  try {
    const rulesResponse = await fetch(`${baseUrl}/api/gui-test/rules`);
    const rulesData = await rulesResponse.json();
    console.log(`✅ 规则数量: ${rulesData.count}条`);
    console.log(`   规则ID: ${rulesData.rules.map(r => r.id).join(', ')}`);
  } catch (error) {
    console.error(`❌ 失败: ${error.message}`);
  }
  
  // 测试2: 运行GUI测试（百度首页）
  console.log('\n测试2: 运行GUI测试（2轮）');
  console.log('⏳ 测试中，请稍候...\n');
  
  try {
    const testResponse = await fetch(`${baseUrl}/api/gui-test/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appType: 'web',
        appPath: 'https://www.baidu.com',
        rounds: 2
      })
    });
    
    const testData = await testResponse.json();
    
    if (testData.success) {
      console.log(`✅ GUI测试完成！`);
      console.log(`   总测试轮数: ${testData.results.total}`);
      console.log(`   通过轮数: ${testData.results.passed}`);
      console.log(`   三重验证: ${testData.results.tripleVerificationPassed ? '✅ 通过' : '❌ 失败'}`);
      console.log(`   5轮测试: ${testData.results.fiveRoundsPassed ? '✅ 通过' : '⚠️  仅${testData.results.total}轮'}`);
      console.log(`   测试时长: ${(testData.results.duration / 1000).toFixed(2)}秒`);
      console.log(`   报告文件: ${testData.results.reportPath}`);
    } else {
      console.error(`❌ 测试失败: ${testData.error}`);
    }
  } catch (error) {
    console.error(`❌ 失败: ${error.message}`);
  }
  
  console.log('\n========== 测试完成 ==========\n');
}

// 运行测试
if (require.main === module) {
  testGUIAPI().catch(console.error);
}

module.exports = testGUIAPI;


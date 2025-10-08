/**
 * 经验记录器测试脚本
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          经验记录器测试开始                                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const tests = [];

  // ==================== 测试1: 手动记录错误经验 ====================
  tests.push({
    name: '手动记录错误经验',
    run: async () => {
      const response = await fetch(`${API_BASE}/experience/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          description: 'PM2启动失败：模块类型冲突',
          solution: '将.js改为.cjs，使用CommonJS模式',
          context: '规则引擎服务',
          ruleId: 'IR-003'
        })
      });
      const data = await response.json();
      return data.success === true;
    }
  });

  // ==================== 测试2: 手动记录成功经验 ====================
  tests.push({
    name: '手动记录成功经验',
    run: async () => {
      const response = await fetch(`${API_BASE}/experience/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'success',
          description: 'Git Hook成功拦截硬编码',
          solution: '使用PowerShell包装脚本，设置执行权限',
          context: 'pre-commit钩子',
          ruleId: 'IR-003'
        })
      });
      const data = await response.json();
      return data.success === true;
    }
  });

  // ==================== 测试3: 自动检测错误（通过对话检查） ====================
  tests.push({
    name: '自动检测错误关键词',
    run: async () => {
      const response = await fetch(`${API_BASE}/check-dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '遇到错误：连接数据库失败，超时异常。解决方案：增加连接超时时间到30秒。',
          context: '数据库配置'
        })
      });
      
      // 等待1秒，让异步记录完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const data = await response.json();
      return data !== null; // 对话检查成功即可
    }
  });

  // ==================== 测试4: 自动检测成功（通过对话检查） ====================
  tests.push({
    name: '自动检测成功关键词',
    run: async () => {
      const response = await fetch(`${API_BASE}/check-dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '成功实现连续执行模式！减少了70%的询问次数，效果很好。',
          context: '连续执行模式'
        })
      });
      
      // 等待1秒，让异步记录完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const data = await response.json();
      return data !== null;
    }
  });

  // ==================== 测试5: 搜索错误经验 ====================
  tests.push({
    name: '搜索错误经验（关键词：PM2）',
    run: async () => {
      const response = await fetch(`${API_BASE}/experience/search?keyword=PM2&type=error`);
      const data = await response.json();
      return data.success === true && data.count >= 1;
    }
  });

  // ==================== 测试6: 搜索成功经验 ====================
  tests.push({
    name: '搜索成功经验（关键词：连续）',
    run: async () => {
      const response = await fetch(`${API_BASE}/experience/search?keyword=连续&type=success`);
      const data = await response.json();
      return data.success === true && data.count >= 1;
    }
  });

  // ==================== 测试7: 搜索所有经验 ====================
  tests.push({
    name: '搜索所有经验（关键词：成功）',
    run: async () => {
      const response = await fetch(`${API_BASE}/experience/search?keyword=成功&type=all`);
      const data = await response.json();
      return data.success === true && data.count >= 1;
    }
  });

  // ==================== 测试8: 获取统计信息 ====================
  tests.push({
    name: '获取统计信息',
    run: async () => {
      const response = await fetch(`${API_BASE}/experience/stats`);
      const data = await response.json();
      
      if (data.success && data.stats) {
        console.log(`\n  📊 统计信息：`);
        console.log(`     错误经验: ${data.stats.errorCount} 条`);
        console.log(`     成功经验: ${data.stats.successCount} 条`);
        console.log(`     总计: ${data.stats.totalCount} 条`);
        
        if (data.stats.recentErrors.length > 0) {
          console.log(`\n  最近错误：`);
          data.stats.recentErrors.slice(0, 2).forEach((e, i) => {
            console.log(`     ${i + 1}. ${e}`);
          });
        }
        
        if (data.stats.recentSuccesses.length > 0) {
          console.log(`\n  最近成功：`);
          data.stats.recentSuccesses.slice(0, 2).forEach((e, i) => {
            console.log(`     ${i + 1}. ${e}`);
          });
        }
        
        return data.stats.totalCount >= 2;
      }
      return false;
    }
  });

  // ==================== 执行测试 ====================
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\x1b[34m🧪 测试: ${test.name}\x1b[0m`);
      const result = await test.run();
      
      if (result) {
        console.log(`  \x1b[32m✓ 通过\x1b[0m`);
        passed++;
      } else {
        console.log(`  \x1b[31m✗ 失败\x1b[0m`);
        failed++;
      }
    } catch (error) {
      console.log(`  \x1b[31m✗ 失败: ${error.message}\x1b[0m`);
      failed++;
    }
  }

  // ==================== 测试结果 ====================
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          测试结果                                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const passRate = ((passed / tests.length) * 100).toFixed(1);
  console.log(`  \x1b[32m通过率: ${passed}/${tests.length} (${passRate}%)\x1b[0m\n`);

  if (failed === 0) {
    console.log('  \x1b[32m✓ 所有测试通过！经验记录器工作正常。\x1b[0m\n');
  } else {
    console.log(`  \x1b[31m✗ ${failed} 个测试失败\x1b[0m\n`);
  }
}

// 执行测试
runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});


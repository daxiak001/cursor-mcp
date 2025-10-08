/**
 * 索引注册器测试脚本
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

async function runTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          索引注册器测试开始                                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const tests = [];

  // ==================== 测试1: 构建索引 ====================
  tests.push({
    name: '构建索引',
    run: async () => {
      const response = await fetch(`${API_BASE}/index/build`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success && data.count > 0) {
        console.log(`\n  📊 索引构建成功：`);
        console.log(`     文件总数: ${data.count}`);
        console.log(`     耗时: ${data.duration}ms`);
        console.log(`     分类:`);
        for (const [cat, count] of Object.entries(data.categories || {})) {
          console.log(`       ${cat}: ${count} 个`);
        }
        return true;
      }
      return false;
    }
  });

  // ==================== 测试2: 获取状态 ====================
  tests.push({
    name: '获取状态',
    run: async () => {
      const response = await fetch(`${API_BASE}/index/status`);
      const data = await response.json();
      
      if (data.built) {
        console.log(`\n  📈 索引状态：`);
        console.log(`     构建时间: ${data.builtAt}`);
        console.log(`     文件总数: ${data.count}`);
        return true;
      }
      return false;
    }
  });

  // ==================== 测试3: 搜索文件（all） ====================
  tests.push({
    name: '搜索文件（关键词：test）',
    run: async () => {
      const response = await fetch(`${API_BASE}/index/search?query=test&limit=5`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`\n  🔍 搜索结果（test）：`);
        console.log(`     找到: ${data.count} 个文件`);
        data.results.slice(0, 3).forEach((r, i) => {
          console.log(`     ${i + 1}. ${r.path} (匹配度: ${r.score.toFixed(0)})`);
        });
        return data.count > 0;
      }
      return false;
    }
  });

  // ==================== 测试4: 搜索文件（code分类） ====================
  tests.push({
    name: '搜索代码文件（关键词：server）',
    run: async () => {
      const response = await fetch(`${API_BASE}/index/search?query=server&category=code&limit=5`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`\n  🔍 搜索代码文件（server）：`);
        console.log(`     找到: ${data.count} 个文件`);
        data.results.slice(0, 3).forEach((r, i) => {
          console.log(`     ${i + 1}. ${r.path} [${r.category}]`);
        });
        return data.count > 0;
      }
      return false;
    }
  });

  // ==================== 测试5: 记录决策 ====================
  tests.push({
    name: '记录决策',
    run: async () => {
      const response = await fetch(`${API_BASE}/index/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: ['如何实现规则引擎', '代码质量检查'],
          targetAction: '创建规则引擎服务',
          targetFiles: ['scripts/rule-engine-server.cjs', 'policy/core-l1.yaml'],
          reason: '实现代码质量检查功能'
        })
      });
      const data = await response.json();
      
      if (data.success) {
        console.log(`\n  ✍️  决策已记录：`);
        console.log(`     文件: ${data.file}`);
        return true;
      }
      return false;
    }
  });

  // ==================== 测试6: 获取文件详情 ====================
  tests.push({
    name: '获取文件详情',
    run: async () => {
      const response = await fetch(`${API_BASE}/index/search?query=package.json&limit=1`);
      const searchData = await response.json();
      
      if (searchData.success && searchData.count > 0) {
        const filePath = searchData.results[0].path;
        
        const detailResponse = await fetch(`${API_BASE}/index/file?path=${encodeURIComponent(filePath)}`);
        const data = await detailResponse.json();
        
        if (data.success) {
          console.log(`\n  📄 文件详情：`);
          console.log(`     路径: ${data.path}`);
          console.log(`     分类: ${data.category}`);
          console.log(`     大小: ${data.size} 字节`);
          console.log(`     SHA256: ${data.sha256.substring(0, 16)}...`);
          return true;
        }
      }
      return false;
    }
  });

  // ==================== 测试7: 获取推荐文件 ====================
  tests.push({
    name: '获取推荐文件',
    run: async () => {
      const response = await fetch(`${API_BASE}/index/search?query=rule-engine&limit=1`);
      const searchData = await response.json();
      
      if (searchData.success && searchData.count > 0) {
        const currentFile = searchData.results[0].path;
        
        const recResponse = await fetch(`${API_BASE}/index/recommendations?file=${encodeURIComponent(currentFile)}&limit=3`);
        const data = await recResponse.json();
        
        if (data.success) {
          console.log(`\n  💡 推荐文件（基于 ${data.currentFile}）：`);
          console.log(`     找到: ${data.count} 个相关文件`);
          data.recommendations.slice(0, 3).forEach((r, i) => {
            console.log(`     ${i + 1}. ${r.path} (相关度: ${r.score})`);
          });
          return data.count > 0;
        }
      }
      return false;
    }
  });

  // ==================== 测试8: 搜索配置文件 ====================
  tests.push({
    name: '搜索配置文件（yaml）',
    run: async () => {
      const response = await fetch(`${API_BASE}/index/search?query=yaml&category=config&limit=5`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`\n  🔍 搜索配置文件（yaml）：`);
        console.log(`     找到: ${data.count} 个文件`);
        data.results.slice(0, 3).forEach((r, i) => {
          console.log(`     ${i + 1}. ${r.path}`);
        });
        return data.count >= 0; // 允许0个结果
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
    console.log('  \x1b[32m✓ 所有测试通过！索引注册器工作正常。\x1b[0m\n');
  } else {
    console.log(`  \x1b[31m✗ ${failed} 个测试失败\x1b[0m\n`);
  }
}

// 执行测试
runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});


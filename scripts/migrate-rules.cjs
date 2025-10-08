/**
 * 规则迁移脚本：YAML → SQLite
 * 执行: node scripts/migrate-rules.cjs
 * 功能: 将现有规则从rule-engine-server.cjs迁移到SQLite
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/xiaoliu.db');

console.log('🚀 开始规则迁移（YAML → SQLite）\n');

// 规则定义（从rule-engine-server.cjs提取）
const RULE_DEFINITIONS = {
  // ==================== 代码质量规则 ====================
  'IR-003': {
    category: 'code',
    type: 'hardcode',
    title: '禁止硬编码敏感信息',
    description: '禁止在代码中硬编码密码、Token、API Key等敏感信息',
    content: JSON.stringify({
      forbiddenPatterns: [
        'password\\s*[:=]\\s*["\'][^"\']{3,}["\']',
        'token\\s*[:=]\\s*["\'][^"\']{3,}["\']',
        'api_?key\\s*[:=]\\s*["\'][^"\']{3,}["\']',
        'secret\\s*[:=]\\s*["\'][^"\']{3,}["\']',
        'mongodb:\\/\\/[^:]+:[^@]+@',
        'mysql:\\/\\/[^:]+:[^@]+@',
        'postgres:\\/\\/[^:]+:[^@]+@'
      ],
      message: '禁止硬编码敏感信息（密码/Token/API Key）'
    }),
    priority: 5,
    level: 'core',
    tags: JSON.stringify(['security', 'hardcode', 'sensitive'])
  },
  
  'IR-005': {
    category: 'code',
    type: 'function_length',
    title: '函数长度限制',
    description: '单个函数长度不得超过50行',
    content: JSON.stringify({
      maxLength: 50,
      message: '函数长度不得超过50行'
    }),
    priority: 3,
    level: 'medium',
    tags: JSON.stringify(['quality', 'complexity', 'maintainability'])
  },
  
  'IR-010': {
    category: 'code',
    type: 'duplicate_check',
    title: '开发前必须查重',
    description: '开发前必须调用xiaoliu_search_codebase查重',
    content: JSON.stringify({
      message: '开发前必须查重（调用xiaoliu_search_codebase）'
    }),
    priority: 4,
    level: 'high',
    tags: JSON.stringify(['workflow', 'duplication', 'search'])
  },
  
  'IR-031': {
    category: 'code',
    type: 'pre_execution_confirm',
    title: '执行前必须输出确认卡',
    description: '重要操作执行前必须输出确认卡（理解、方案、风险、确认）',
    content: JSON.stringify({
      requiredSections: ['理解', '方案', '风险', '确认'],
      message: '执行前必须输出确认卡'
    }),
    priority: 5,
    level: 'core',
    tags: JSON.stringify(['workflow', 'confirmation', 'safety'])
  },
  
  'IR-038': {
    category: 'code',
    type: 'naming',
    title: 'API命名规范',
    description: '关键导出/API命名需清晰、语义化，禁止缩写',
    content: JSON.stringify({
      patterns: [
        'export\\s+(function|class|const)\\s+[a-z]',
        '\\b(btn|img|txt|num|str|arr|obj)\\b'
      ],
      message: '关键导出/API命名需清晰、语义化，禁止缩写'
    }),
    priority: 3,
    level: 'medium',
    tags: JSON.stringify(['naming', 'readability', 'api'])
  },
  
  // ==================== 对话行为规则 ====================
  'SIL-003': {
    category: 'dialogue',
    type: 'no_ask',
    title: '禁止询问用户',
    description: 'AI不得询问用户，应自主决策',
    content: JSON.stringify({
      forbiddenPatterns: ['[？?]', '请确认', '是否', '你觉得', '需要.*吗', '可以.*吗'],
      message: '不得询问用户，应自主决策'
    }),
    priority: 5,
    level: 'core',
    tags: JSON.stringify(['dialogue', 'autonomous', 'no-question'])
  },
  
  'SIL-004': {
    category: 'dialogue',
    type: 'no_wait',
    title: '禁止等待用户',
    description: 'AI不得等待用户输入，应持续执行',
    content: JSON.stringify({
      forbiddenPatterns: ['等待你的', '等你', '请回复', '告诉我', '让我知道'],
      message: '不得等待用户，应持续执行'
    }),
    priority: 5,
    level: 'core',
    tags: JSON.stringify(['dialogue', 'continuous', 'no-wait'])
  },
  
  'IR-001': {
    category: 'dialogue',
    type: 'understanding',
    title: '回复前必须理解确认',
    description: '回复前应先输出理解确认',
    content: JSON.stringify({
      requiredPatterns: ['理解为', '我的理解', '意图是', '需求是'],
      message: '回复前应先输出理解确认'
    }),
    priority: 4,
    level: 'high',
    tags: JSON.stringify(['dialogue', 'understanding', 'confirmation'])
  },
  
  'WF-001': {
    category: 'workflow',
    type: 'role_permission',
    title: '角色权限控制',
    description: '禁止角色越权操作',
    content: JSON.stringify({
      roles: {
        'XH': ['架构设计', '技术选型', '代码编写'],
        'XP': ['需求分析', '方案评审'],
        'XL': ['代码编写', '测试'],
        'XG': ['代码审查', '质量把关']
      },
      message: '角色越权禁止'
    }),
    priority: 4,
    level: 'high',
    tags: JSON.stringify(['workflow', 'role', 'permission'])
  },
  
  'WF-002': {
    category: 'workflow',
    type: 'workflow_rhythm',
    title: '执行节拍控制',
    description: '必须遵守执行节拍：确认→执行→验收→最终确认',
    content: JSON.stringify({
      sequence: ['确认', '执行', '验收', '最终确认'],
      message: '执行节拍必须遵守'
    }),
    priority: 4,
    level: 'high',
    tags: JSON.stringify(['workflow', 'rhythm', 'sequence'])
  },
  
  'WF-003': {
    category: 'workflow',
    type: 'evidence_retention',
    title: '证据留存',
    description: '必须保留确认卡摘要和测试报告',
    content: JSON.stringify({
      requiredFiles: ['确认卡摘要', '测试报告'],
      message: '证据留存必须登记'
    }),
    priority: 3,
    level: 'medium',
    tags: JSON.stringify(['workflow', 'evidence', 'documentation'])
  }
};

(async function migrateRules() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ 数据库文件不存在，请先运行 db-init.cjs');
    process.exit(1);
  }
  
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(filebuffer);
  
  const total = Object.keys(RULE_DEFINITIONS).length;
  console.log(`📦 待迁移规则: ${total}条\n`);
  
  let migrated = 0;
  let failed = 0;
  
  // 开启事务
  db.run('BEGIN TRANSACTION');
  
  // 插入规则
  for (const [ruleId, ruleData] of Object.entries(RULE_DEFINITIONS)) {
    try {
      db.run(`
        INSERT OR REPLACE INTO rules 
        (id, category, type, title, description, content, priority, level, tags, version, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ruleId,
        ruleData.category,
        ruleData.type,
        ruleData.title,
        ruleData.description || '',
        ruleData.content,
        ruleData.priority,
        ruleData.level,
        ruleData.tags,
        'v1.0',
        1 // enabled
      ]);
      
      console.log(`✅ ${ruleId} → SQLite (${ruleData.category}/${ruleData.type})`);
      migrated++;
    } catch (err) {
      console.error(`❌ ${ruleId} 迁移失败:`, err.message);
      failed++;
    }
  }
  
  // 提交事务
  db.run('COMMIT');
  
  console.log(`\n✅ 规则迁移完成！`);
  console.log(`   成功: ${migrated}/${total}条`);
  if (failed > 0) {
    console.log(`   失败: ${failed}条`);
  }
  
  // 验证统计
  const stats = db.exec(`
    SELECT category, COUNT(*) as count 
    FROM rules 
    WHERE enabled = 1
    GROUP BY category
  `);
  
  if (stats.length > 0) {
    console.log(`\n📊 规则分类统计:`);
    stats[0].values.forEach(row => console.log(`   - ${row[0]}: ${row[1]}条`));
  }
  
  // 显示总数
  const totalResult = db.exec('SELECT COUNT(*) as total FROM rules WHERE enabled=1');
  if (totalResult.length > 0) {
    console.log(`   总计: ${totalResult[0].values[0][0]}条\n`);
  }
  
  // 保存数据库
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  
  console.log('💾 数据库已保存\n');
  db.close();
})();


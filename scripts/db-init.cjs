/**
 * 数据库初始化脚本
 * 执行: node scripts/db-init.cjs
 * 功能: 创建SQLite数据库并执行Schema
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/xiaoliu.db');
const SCHEMA_PATH = path.join(__dirname, 'db-schema.sql');

console.log('🚀 小柳系统数据库初始化\n');

// 确保data目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ 创建data目录:', dataDir);
}

// 检查Schema文件
if (!fs.existsSync(SCHEMA_PATH)) {
  console.error('❌ Schema文件不存在:', SCHEMA_PATH);
  process.exit(1);
}

// 读取Schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

// 初始化sql.js并创建数据库
(async () => {
  const SQL = await initSqlJs();
  
  // 检查是否已有数据库文件
  let db;
  if (fs.existsSync(DB_PATH)) {
    const filebuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(filebuffer);
    console.log('✅ 数据库已加载:', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('✅ 创建新数据库:', DB_PATH);
  }
  
  // 执行Schema（直接执行整个文件）
  console.log(`\n📝 执行Schema\n`);
  
  try {
    db.exec(schema);
    console.log('✅ Schema执行成功');
  } catch (err) {
    console.error('❌ Schema执行失败:', err.message);
    process.exit(1);
  }
  
  // 验证表创建
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (tables.length > 0) {
    console.log(`\n📊 数据表清单:`);
    tables[0].values.forEach(row => console.log(`   - ${row[0]}`));
  }
  
  // 验证配置预填充
  const configs = db.exec("SELECT key, value FROM persistent_config");
  if (configs.length > 0) {
    console.log(`\n⚙️  预填充配置: ${configs[0].values.length}个`);
    configs[0].values.forEach(row => console.log(`   - ${row[0]}: ${row[1]}`));
  }
  
  // 保存数据库
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  
  console.log('\n🎉 数据库已保存！初始化完成。\n');
  db.close();
})();


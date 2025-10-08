/**
 * 数据访问层 (Data Access Layer)
 * 提供对SQLite数据库的封装操作
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/xiaoliu.db');

class DatabaseAccess {
  constructor() {
    this.SQL = null;
    this.db = null;
  }

  /**
   * 初始化数据库连接
   */
  async init() {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('数据库文件不存在，请先运行 db-init.cjs');
    }

    this.SQL = await initSqlJs();
    const filebuffer = fs.readFileSync(DB_PATH);
    this.db = new this.SQL.Database(filebuffer);
  }

  /**
   * 保存数据库到文件
   */
  save() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ==================== 规则操作 ====================

  /**
   * 获取所有启用的规则
   */
  getAllRules(category = null) {
    let sql = 'SELECT * FROM rules WHERE enabled = 1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY priority DESC, id ASC';

    const result = this.db.exec(sql, params);
    return this._parseResults(result);
  }

  /**
   * 根据ID获取规则
   */
  getRuleById(ruleId) {
    const result = this.db.exec('SELECT * FROM rules WHERE id = ?', [ruleId]);
    const rows = this._parseResults(result);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 根据类型获取规则
   */
  getRulesByType(type) {
    const result = this.db.exec('SELECT * FROM rules WHERE type = ? AND enabled = 1 ORDER BY priority DESC', [type]);
    return this._parseResults(result);
  }

  /**
   * 创建或更新规则
   */
  upsertRule(ruleData) {
    const {
      id, category, type, title, description = '',
      content, priority = 3, level = 'medium',
      tags = '[]', conflicts = null, merge_strategy = 'prefer_high_priority',
      version = 'v1.0', enabled = 1
    } = ruleData;

    this.db.run(`
      INSERT OR REPLACE INTO rules 
      (id, category, type, title, description, content, priority, level, tags, conflicts, merge_strategy, version, enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [id, category, type, title, description, content, priority, level, tags, conflicts, merge_strategy, version, enabled]);

    this.save();
  }

  /**
   * 删除规则（软删除：设置enabled=0）
   */
  deleteRule(ruleId) {
    this.db.run('UPDATE rules SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ruleId]);
    this.save();
  }

  // ==================== 任务操作 ====================

  /**
   * 创建任务
   */
  createTask(taskData) {
    const {
      id, title, description = '', state = 'new',
      rule_ids = '[]', artifacts_ref = '', validation_result = '',
      ui_test_job_id = '', changed_by = '', change_reason = ''
    } = taskData;

    this.db.run(`
      INSERT INTO tasks 
      (id, title, description, state, rule_ids, artifacts_ref, validation_result, ui_test_job_id, changed_by, change_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, title, description, state, rule_ids, artifacts_ref, validation_result, ui_test_job_id, changed_by, change_reason]);

    this.save();
  }

  /**
   * 更新任务状态
   */
  updateTaskState(taskId, newState, changedBy = '', changeReason = '') {
    const completedAt = newState === 'validated' ? 'CURRENT_TIMESTAMP' : 'NULL';

    this.db.run(`
      UPDATE tasks 
      SET state = ?, changed_by = ?, change_reason = ?, updated_at = CURRENT_TIMESTAMP, 
          completed_at = CASE WHEN ? = 'validated' THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = ?
    `, [newState, changedBy, changeReason, newState, taskId]);

    this.save();
  }

  /**
   * 获取任务
   */
  getTaskById(taskId) {
    const result = this.db.exec('SELECT * FROM tasks WHERE id = ?', [taskId]);
    const rows = this._parseResults(result);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 获取指定状态的任务
   */
  getTasksByState(state) {
    const result = this.db.exec('SELECT * FROM tasks WHERE state = ? ORDER BY created_at DESC', [state]);
    return this._parseResults(result);
  }

  // ==================== 审计日志 ====================

  /**
   * 记录审计日志
   */
  logAudit(auditData) {
    const {
      task_id = null, rule_id = null, action, actor = '',
      target = '', result = '', severity = 'info', duration = null
    } = auditData;

    this.db.run(`
      INSERT INTO audit_logs 
      (task_id, rule_id, action, actor, target, result, severity, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [task_id, rule_id, action, actor, target, result, severity, duration]);

    this.save();
  }

  /**
   * 获取审计日志
   */
  getAuditLogs(filters = {}) {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (filters.task_id) {
      sql += ' AND task_id = ?';
      params.push(filters.task_id);
    }

    if (filters.rule_id) {
      sql += ' AND rule_id = ?';
      params.push(filters.rule_id);
    }

    if (filters.severity) {
      sql += ' AND severity = ?';
      params.push(filters.severity);
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    const result = this.db.exec(sql, params);
    return this._parseResults(result);
  }

  // ==================== 经验库 ====================

  /**
   * 记录经验
   */
  createLesson(lessonData) {
    const {
      id, type, problem, solution = '', context = '{}',
      tags = '[]', rule_ids = '[]', task_ids = '[]',
      success_rate = 1.0, usage_count = 0
    } = lessonData;

    this.db.run(`
      INSERT INTO lessons 
      (id, type, problem, solution, context, tags, rule_ids, task_ids, success_rate, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, type, problem, solution, context, tags, rule_ids, task_ids, success_rate, usage_count]);

    this.save();
  }

  /**
   * 搜索经验
   */
  searchLessons(keyword, type = null) {
    let sql = `
      SELECT * FROM lessons 
      WHERE (problem LIKE ? OR solution LIKE ?)
    `;
    const params = [`%${keyword}%`, `%${keyword}%`];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY success_rate DESC, usage_count DESC LIMIT 20';

    const result = this.db.exec(sql, params);
    return this._parseResults(result);
  }

  /**
   * 更新经验使用次数
   */
  incrementLessonUsage(lessonId) {
    this.db.run(`
      UPDATE lessons 
      SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [lessonId]);

    this.save();
  }

  // ==================== 配置管理 ====================

  /**
   * 获取配置
   */
  getConfig(key) {
    const result = this.db.exec('SELECT value, type FROM persistent_config WHERE key = ?', [key]);
    const rows = this._parseResults(result);

    if (rows.length === 0) return null;

    const { value, type } = rows[0];

    // 类型转换
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'json':
        return JSON.parse(value);
      default:
        return value;
    }
  }

  /**
   * 设置配置
   */
  setConfig(key, value, type = 'string', description = '') {
    let valueStr = value;

    if (type === 'json') {
      valueStr = JSON.stringify(value);
    } else if (type === 'boolean') {
      valueStr = value ? '1' : '0';
    } else {
      valueStr = String(value);
    }

    this.db.run(`
      INSERT OR REPLACE INTO persistent_config 
      (key, value, type, description, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [key, valueStr, type, description]);

    this.save();
  }

  // ==================== 工具方法 ====================

  /**
   * 解析查询结果为对象数组
   */
  _parseResults(result) {
    if (!result || result.length === 0) return [];

    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  /**
   * 执行原始SQL
   */
  exec(sql, params = []) {
    const result = this.db.exec(sql, params);
    return this._parseResults(result);
  }
}

// 单例模式
let instance = null;

async function getDB() {
  if (!instance) {
    instance = new DatabaseAccess();
    await instance.init();
  }
  return instance;
}

module.exports = { DatabaseAccess, getDB };


/**
 * 规则引擎服务 - SQLite增强版
 * 功能：
 * 1. 从SQLite加载规则（替代YAML）
 * 2. 提供API接口检查代码质量和对话行为
 * 3. 物理阻断违规行为
 * 4. 持久化配置和审计日志
 * 
 * 升级内容：
 * - ✅ SQLite持久化存储
 * - ✅ 规则版本控制
 * - ✅ 审计日志记录
 * - ✅ 经验库集成
 */

const express = require('express');
const path = require('path');
const { getDB } = require('../db-access.cjs');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

let db = null;
let codeRules = [];
let dialogueRules = [];
let workflowRules = [];

/**
 * 初始化数据库连接
 */
async function initDB() {
  try {
    db = await getDB();
    console.log('[规则引擎-SQLite] 数据库连接成功');
    await loadRulesFromDB();
  } catch (error) {
    console.error('[规则引擎-SQLite] 数据库初始化失败:', error.message);
    process.exit(1);
  }
}

/**
 * 从SQLite加载规则
 */
async function loadRulesFromDB() {
  try {
    const allRules = db.getAllRules();
    
    codeRules = allRules.filter(r => r.category === 'code').map(parseRule);
    dialogueRules = allRules.filter(r => r.category === 'dialogue').map(parseRule);
    workflowRules = allRules.filter(r => r.category === 'workflow').map(parseRule);
    
    console.log(`[规则引擎-SQLite] 规则加载成功 - 代码: ${codeRules.length}, 对话: ${dialogueRules.length}, 工作流: ${workflowRules.length}`);
  } catch (error) {
    console.error('[规则引擎-SQLite] 规则加载失败:', error.message);
  }
}

/**
 * 解析规则数据
 */
function parseRule(dbRule) {
  let content = {};
  try {
    content = typeof dbRule.content === 'string' ? JSON.parse(dbRule.content) : dbRule.content;
  } catch (e) {
    console.warn(`[规则引擎-SQLite] 规则 ${dbRule.id} 内容解析失败`);
  }

  return {
    id: dbRule.id,
    type: dbRule.type,
    title: dbRule.title,
    description: dbRule.description,
    priority: dbRule.priority,
    level: dbRule.level,
    patterns: content.forbiddenPatterns || content.requiredPatterns || content.patterns || [],
    message: content.message || dbRule.description,
    ...content
  };
}

/**
 * 检查代码质量
 */
function checkCodeQuality(code, filePath = '') {
  const violations = [];
  
  for (const rule of codeRules) {
    if (!rule.patterns || rule.patterns.length === 0) continue;
    
    for (const pattern of rule.patterns) {
      try {
        const regex = new RegExp(pattern, 'gm');
        const matches = code.match(regex);
        
        if (matches && matches.length > 0) {
          violations.push({
            ruleId: rule.id,
            type: rule.type,
            level: rule.level,
            message: rule.message,
            count: matches.length,
            samples: matches.slice(0, 3)
          });

          // 记录审计日志
          if (db) {
            db.logAudit({
              rule_id: rule.id,
              action: 'check',
              target: filePath || 'inline-code',
              result: JSON.stringify({ matches: matches.length }),
              severity: rule.level === 'core' ? 'error' : 'warn'
            });
          }
        }
      } catch (e) {
        console.warn(`[规则引擎-SQLite] 规则 ${rule.id} 模式错误: ${pattern}`);
      }
    }
  }
  
  return violations;
}

/**
 * 检查对话行为
 */
function checkDialogueBehavior(text) {
  const violations = [];
  
  for (const rule of dialogueRules) {
    if (!rule.patterns || rule.patterns.length === 0) continue;
    
    for (const pattern of rule.patterns) {
      try {
        const regex = new RegExp(pattern, 'g');
        const matches = text.match(regex);
        
        if (matches && matches.length > 0) {
          violations.push({
            ruleId: rule.id,
            type: rule.type,
            level: rule.level,
            message: rule.message,
            count: matches.length,
            samples: matches.slice(0, 3)
          });

          // 记录审计日志
          if (db) {
            db.logAudit({
              rule_id: rule.id,
              action: 'check',
              target: 'dialogue',
              result: JSON.stringify({ matches: matches.length }),
              severity: rule.level === 'core' ? 'error' : 'warn'
            });
          }
        }
      } catch (e) {
        console.warn(`[规则引擎-SQLite] 规则 ${rule.id} 模式错误: ${pattern}`);
      }
    }
  }
  
  return violations;
}

/**
 * 质量门禁检查
 */
function qualityGateCheck(violations) {
  const coreViolations = violations.filter(v => v.level === 'core');
  const highViolations = violations.filter(v => v.level === 'high');
  
  return {
    passed: coreViolations.length === 0,
    coreCount: coreViolations.length,
    highCount: highViolations.length,
    totalCount: violations.length,
    violations: coreViolations.length > 0 ? coreViolations : violations
  };
}

// ==================== API路由 ====================

/**
 * API 1: 检查代码质量
 */
app.post('/api/check-code', (req, res) => {
  const { code, filePath } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: '缺少code参数' });
  }
  
  const violations = checkCodeQuality(code, filePath);
  const gate = qualityGateCheck(violations);
  
  res.json({
    passed: gate.passed,
    violations: gate.violations,
    summary: {
      core: gate.coreCount,
      high: gate.highCount,
      total: gate.totalCount
    }
  });
});

/**
 * API 2: 检查对话行为
 */
app.post('/api/check-dialogue', (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: '缺少text参数' });
  }
  
  const violations = checkDialogueBehavior(text);
  const gate = qualityGateCheck(violations);
  
  res.json({
    passed: gate.passed,
    violations: gate.violations,
    summary: {
      core: gate.coreCount,
      high: gate.highCount,
      total: gate.totalCount
    }
  });
});

/**
 * API 3: 质量门禁
 */
app.post('/api/quality-gate', (req, res) => {
  const { code, dialogue } = req.body;
  
  let allViolations = [];
  
  if (code) {
    allViolations = allViolations.concat(checkCodeQuality(code));
  }
  
  if (dialogue) {
    allViolations = allViolations.concat(checkDialogueBehavior(dialogue));
  }
  
  const gate = qualityGateCheck(allViolations);
  
  res.json({
    passed: gate.passed,
    violations: gate.violations,
    summary: {
      core: gate.coreCount,
      high: gate.highCount,
      total: gate.totalCount
    }
  });
});

/**
 * API 4: 重新加载规则
 */
app.post('/api/reload-rules', async (req, res) => {
  try {
    await loadRulesFromDB();
    res.json({ success: true, message: '规则重新加载成功', counts: { code: codeRules.length, dialogue: dialogueRules.length, workflow: workflowRules.length } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 5: 健康检查
 */
app.get('/api/health', (req, res) => {
  const response = {
    status: 'ok',
    mode: 'sqlite',
    rules: {
      code: codeRules?.length || 0,
      dialogue: dialogueRules?.length || 0,
      workflow: workflowRules?.length || 0,
      total: (codeRules?.length || 0) + (dialogueRules?.length || 0) + (workflowRules?.length || 0)
    },
    database: db ? 'connected' : 'disconnected'
  };
  res.json(response);
});

// ==================== 规则管理API（新增） ====================

/**
 * API 6: 获取所有规则
 */
app.get('/api/rules', (req, res) => {
  const { category, type } = req.query;
  
  try {
    let rules;
    if (category) {
      rules = db.getAllRules(category);
    } else if (type) {
      rules = db.getRulesByType(type);
    } else {
      rules = db.getAllRules();
    }
    
    res.json({ success: true, rules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 7: 获取单个规则
 */
app.get('/api/rules/:id', (req, res) => {
  try {
    const rule = db.getRuleById(req.params.id);
    
    if (!rule) {
      return res.status(404).json({ error: '规则不存在' });
    }
    
    res.json({ success: true, rule });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 8: 创建/更新规则
 */
app.post('/api/rules', (req, res) => {
  try {
    db.upsertRule(req.body);
    
    // 重新加载规则到内存
    loadRulesFromDB();
    
    res.json({ success: true, message: '规则已保存' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 9: 删除规则
 */
app.delete('/api/rules/:id', (req, res) => {
  try {
    db.deleteRule(req.params.id);
    
    // 重新加载规则到内存
    loadRulesFromDB();
    
    res.json({ success: true, message: '规则已删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 审计日志API（新增） ====================

/**
 * API 10: 获取审计日志
 */
app.get('/api/audit-logs', (req, res) => {
  const { task_id, rule_id, severity } = req.query;
  
  try {
    const logs = db.getAuditLogs({ task_id, rule_id, severity });
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 经验库API（新增） ====================

/**
 * API 11: 搜索经验
 */
app.get('/api/lessons/search', (req, res) => {
  const { keyword, type } = req.query;
  
  if (!keyword) {
    return res.status(400).json({ error: '缺少keyword参数' });
  }
  
  try {
    const lessons = db.searchLessons(keyword, type);
    res.json({ success: true, lessons });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 12: 记录经验
 */
app.post('/api/lessons', (req, res) => {
  try {
    db.createLesson(req.body);
    res.json({ success: true, message: '经验已记录' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 13: 增加经验使用次数
 */
app.post('/api/lessons/:id/use', (req, res) => {
  try {
    db.incrementLessonUsage(req.params.id);
    res.json({ success: true, message: '使用次数已更新' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 配置管理API（新增） ====================

/**
 * API 14: 获取配置
 */
app.get('/api/config/:key', (req, res) => {
  try {
    const value = db.getConfig(req.params.key);
    
    if (value === null) {
      return res.status(404).json({ error: '配置不存在' });
    }
    
    res.json({ success: true, key: req.params.key, value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 15: 设置配置
 */
app.post('/api/config', (req, res) => {
  const { key, value, type, description } = req.body;
  
  if (!key || value === undefined) {
    return res.status(400).json({ error: '缺少key或value参数' });
  }
  
  try {
    db.setConfig(key, value, type, description);
    res.json({ success: true, message: '配置已保存' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 启动服务 ====================

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[规则引擎-SQLite] 服务启动成功，端口: ${PORT}`);
    console.log(`[规则引擎-SQLite] 健康检查: http://localhost:${PORT}/api/health`);
    console.log(`[规则引擎-SQLite] 模式: SQLite持久化`);
  });
});

module.exports = app;


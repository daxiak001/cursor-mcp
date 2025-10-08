-- ==================== 小柳系统数据库Schema ====================
-- 版本: v6.1
-- 创建时间: 2025-10-07
-- 说明: Express规则引擎SQLite持久化Schema

-- ==================== 规则表 ====================
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,                    -- RL-001, IR-003, SIL-003等
  category TEXT NOT NULL,                 -- 'code' | 'dialogue' | 'workflow'
  type TEXT NOT NULL,                     -- 'hardcode' | 'no_ask' | 'workflow_rhythm'
  title TEXT NOT NULL,                    -- 规则标题
  description TEXT,                       -- 规则描述
  content TEXT NOT NULL,                  -- 规则内容（JSON格式）
  priority INTEGER DEFAULT 3,             -- 优先级 1-5
  level TEXT DEFAULT 'medium',            -- 'core' | 'high' | 'medium' | 'low'
  version TEXT DEFAULT 'v1.0',            -- 版本号
  enabled BOOLEAN DEFAULT 1,              -- 是否启用
  conflicts TEXT,                         -- 冲突规则ID（JSON数组）
  merge_strategy TEXT DEFAULT 'prefer_high_priority', -- 合并策略
  tags TEXT,                              -- 标签（JSON数组）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rules_category ON rules(category);
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority DESC);

-- ==================== 任务表 ====================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,                    -- TASK-001等
  title TEXT NOT NULL,
  description TEXT,
  state TEXT NOT NULL DEFAULT 'new',      -- 'new' | 'confirmed' | 'in_dev' | 'in_test' | 'validated' | 'archived'
  rule_ids TEXT,                          -- 关联规则ID（JSON数组）
  artifacts_ref TEXT,                     -- 产物引用（文件路径等）
  validation_result TEXT,                 -- 校验结果（JSON）
  ui_test_job_id TEXT,                    -- UI测试任务ID
  changed_by TEXT,                        -- 操作人
  change_reason TEXT,                     -- 变更原因
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- ==================== 审计日志表 ====================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,                           -- 关联任务ID
  rule_id TEXT,                           -- 关联规则ID
  action TEXT NOT NULL,                   -- 'check' | 'validate' | 'fix' | 'reject'
  actor TEXT,                             -- 执行者
  target TEXT,                            -- 目标（文件路径/对话等）
  result TEXT,                            -- 结果（JSON）
  severity TEXT DEFAULT 'info',           -- 'info' | 'warn' | 'error'
  duration INTEGER,                       -- 执行耗时（ms）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(task_id) REFERENCES tasks(id),
  FOREIGN KEY(rule_id) REFERENCES rules(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_rule ON audit_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);

-- ==================== 经验库表 ====================
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,                    -- LESSON-001等
  type TEXT NOT NULL,                     -- 'error' | 'success' | 'optimization'
  problem TEXT NOT NULL,                  -- 问题描述
  solution TEXT,                          -- 解决方案
  context TEXT,                           -- 上下文（JSON）
  tags TEXT,                              -- 标签（JSON数组）
  rule_ids TEXT,                          -- 关联规则（JSON数组）
  task_ids TEXT,                          -- 关联任务（JSON数组）
  success_rate REAL DEFAULT 1.0,          -- 成功率 0.0-1.0
  usage_count INTEGER DEFAULT 0,          -- 使用次数
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lessons_type ON lessons(type);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON lessons(created_at DESC);

-- ==================== 升级候选表 ====================
CREATE TABLE IF NOT EXISTS upgrade_candidates (
  id TEXT PRIMARY KEY,                    -- UPG-001等
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,                            -- 'meeting' | 'test' | 'validation'
  priority INTEGER DEFAULT 3,             -- 优先级 1-5
  estimated_cost TEXT,                    -- 预估成本
  expected_benefit TEXT,                  -- 预期收益
  status TEXT DEFAULT 'pending',          -- 'pending' | 'approved' | 'rejected' | 'implemented'
  related_tasks TEXT,                     -- 关联任务（JSON数组）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  evaluated_at TIMESTAMP,
  implemented_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_upgrade_status ON upgrade_candidates(status);
CREATE INDEX IF NOT EXISTS idx_upgrade_priority ON upgrade_candidates(priority DESC);

-- ==================== 配置表（持久化配置） ====================
CREATE TABLE IF NOT EXISTS persistent_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'string',             -- 'string' | 'number' | 'boolean' | 'json'
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 预填充核心配置
INSERT OR IGNORE INTO persistent_config (key, value, type, description) VALUES
  ('ssh_port', '22', 'number', 'SSH端口'),
  ('api_port', '8889', 'number', 'API端口'),
  ('server_host', '', 'string', '服务器地址'),
  ('execution_rate_target', '95', 'number', '执行率目标(%)');

-- ==================== 会话表（连续模式状态） ====================
CREATE TABLE IF NOT EXISTS continuous_sessions (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT 0,
  task_description TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration INTEGER,                       -- 持续时间（秒）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


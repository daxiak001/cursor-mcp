/**
 * 规则引擎服务
 * 功能：
 * 1. 加载policy/*.yaml规则
 * 2. 提供API接口检查代码质量和对话行为
 * 3. 物理阻断违规行为
 * 
 * 执行率目标：95%
 */

const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const monitor = require('./monitor-logger.cjs');
const continuousMode = require('./continuous-mode.cjs');
const experienceLogger = require('./experience-logger.cjs');
const indexRegistry = require('./index-registry.cjs');
const GUITestRunner = require('../gui-testing/gui-test-runner.cjs');
const VersionManager = require('../tools/version.cjs');
const SelfIntroduction = require('../tools/self-intro.cjs');

// v6.1 四角色系统模块
const GUITestRunnerV61 = require('./gui-test-runner.cjs');
const SkillLibrary = require('./skill-library.cjs');
const DialogueConfirmation = require('./dialogue-confirmation.cjs');
const LoopProtection = require('./loop-protection.cjs');
const RoleManager = require('./role-manager.cjs');
const MeetingEngine = require('./meeting-engine.cjs');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;
const POLICY_DIR = path.join(__dirname, '../../policy');

// 规则缓存
let codeRules = null;
let dialogueRules = null;
let guiTestingRules = null;
let dataFormatRules = null;
let guiBestPracticesRules = null;
let lastLoadTime = 0;

/**
 * 加载所有规则（改表即用）
 */
function loadRules(force = false) {
  const now = Date.now();
  // 每5秒最多重新加载一次
  if (!force && codeRules && dialogueRules && (now - lastLoadTime) < 5000) {
    return;
  }

  try {
    console.log(`[规则引擎] POLICY_DIR: ${POLICY_DIR}`);
    
    // 加载代码质量规则
    const corePath = path.join(POLICY_DIR, 'core-l1.yaml');
    console.log(`[规则引擎] 检查代码规则文件: ${corePath}, 存在: ${fs.existsSync(corePath)}`);
    if (fs.existsSync(corePath)) {
      const content = fs.readFileSync(corePath, 'utf8');
      codeRules = parseYamlRules(content);
      console.log(`[规则引擎] 代码规则解析结果: ${codeRules.length} 条`);
    }

    // 加载对话行为规则
    const dialoguePath = path.join(POLICY_DIR, 'dialogue-l1.yaml');
    console.log(`[规则引擎] 检查对话规则文件: ${dialoguePath}, 存在: ${fs.existsSync(dialoguePath)}`);
    if (fs.existsSync(dialoguePath)) {
      const content = fs.readFileSync(dialoguePath, 'utf8');
      dialogueRules = parseYamlRules(content);
      console.log(`[规则引擎] 对话规则解析结果: ${dialogueRules.length} 条`);
    }

    // 加载GUI测试规则
    const guiPath = path.join(POLICY_DIR, 'gui-testing-l2.yaml');
    console.log(`[规则引擎] 检查GUI测试规则文件: ${guiPath}, 存在: ${fs.existsSync(guiPath)}`);
    if (fs.existsSync(guiPath)) {
      const content = fs.readFileSync(guiPath, 'utf8');
      guiTestingRules = parseYamlRules(content);
      console.log(`[规则引擎] GUI测试规则解析结果: ${guiTestingRules.length} 条`);
    }

    // 加载数据格式规范（IR-040）
    const dataFormatPath = path.join(POLICY_DIR, 'data-format-l1.yaml');
    console.log(`[规则引擎] 检查数据格式规则文件: ${dataFormatPath}, 存在: ${fs.existsSync(dataFormatPath)}`);
    if (fs.existsSync(dataFormatPath)) {
      const content = fs.readFileSync(dataFormatPath, 'utf8');
      dataFormatRules = parseYamlRules(content);
      console.log(`[规则引擎] 数据格式规则解析结果: ${dataFormatRules.length} 条`);
    }

    // 加载GUI测试最佳实践
    const guiBestPath = path.join(POLICY_DIR, 'gui-testing-best-practices.yaml');
    console.log(`[规则引擎] 检查GUI最佳实践文件: ${guiBestPath}, 存在: ${fs.existsSync(guiBestPath)}`);
    if (fs.existsSync(guiBestPath)) {
      const content = fs.readFileSync(guiBestPath, 'utf8');
      guiBestPracticesRules = parseYamlRules(content);
      console.log(`[规则引擎] GUI最佳实践规则解析结果: ${guiBestPracticesRules.length} 条`);
    }

    lastLoadTime = now;
    console.log(`[规则引擎] 规则加载成功 - 代码规则: ${codeRules?.length || 0}, 对话规则: ${dialogueRules?.length || 0}, GUI测试规则: ${guiTestingRules?.length || 0}, 数据格式规则: ${dataFormatRules?.length || 0}, GUI最佳实践: ${guiBestPracticesRules?.length || 0}`);
  } catch (error) {
    console.error('[规则引擎] 规则加载失败:', error.message);
    console.error(error.stack);
  }
}

/**
 * 解析YAML规则
 */
function parseYamlRules(content) {
  const rules = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // 解析格式: - IR-003: 禁硬编码
    const match = trimmed.match(/^-\s*([A-Z]+-\d+):\s*(.+)$/);
    if (match) {
      const [, id, description] = match;
      rules.push({
        id,
        description,
        patterns: getRulePatternsById(id)
      });
    }
  }
  
  return rules;
}

/**
 * 根据规则ID获取检测模式
 */
function getRulePatternsById(ruleId) {
  const patterns = {
    // 代码质量规则
    'IR-003': {
      type: 'hardcode',
      forbiddenPatterns: [
        /password\s*[:=]\s*["'][^"']{3,}["']/gi,  // password: "xxx" 或 password = "xxx"
        /token\s*[:=]\s*["'][^"']{3,}["']/gi,
        /api_?key\s*[:=]\s*["'][^"']{3,}["']/gi,
        /secret\s*[:=]\s*["'][^"']{3,}["']/gi,
        /mongodb:\/\/[^:]+:[^@]+@/gi,
        /mysql:\/\/[^:]+:[^@]+@/gi,
        /postgres:\/\/[^:]+:[^@]+@/gi,
      ],
      message: '禁止硬编码敏感信息（密码/Token/API Key）'
    },
    'IR-005': {
      type: 'function_length',
      maxLength: 50,
      message: '函数长度不得超过50行'
    },
    'IR-040': {
      type: 'data_format',
      forbiddenPatterns: [
        /\.md["']?\s*[:=]\s*["'][^"']*\.md["']/gi,  // file.md = "xxx.md"
        /writeFile.*\.md["']/gi,                     // writeFile("xxx.md")
        /createFile.*\.md["']/gi,                    // createFile("xxx.md")
        /fs\.write.*\.md["']/gi,                     // fs.writeFileSync("xxx.md")
      ],
      message: 'IR-040: 禁止使用MD格式保存数据，必须使用JSON'
    },
    'TEST-001': {
      type: 'gui_testing',
      requiredPatterns: [
        /pyautogui\.screenshot/,
        /\.save\(/,
      ],
      message: 'GUI测试必须包含截图验证'
    },
    'TEST-002': {
      type: 'gui_testing',
      requiredPatterns: [
        /pyautogui\.size\(\)/,
      ],
      message: 'GUI测试必须先检测屏幕分辨率'
    },
    'IR-010': {
      type: 'duplicate_check',
      message: '开发前必须查重（调用xiaoliu_search_codebase）'
    },
    'IR-031': {
      type: 'pre_execution_confirm',
      requiredSections: ['理解', '方案', '风险', '确认'],
      message: '执行前必须输出确认卡'
    },
    'IR-038': {
      type: 'naming',
      patterns: [
        /export\s+(function|class|const)\s+[a-z]/,  // 导出命名应该大写开头
        /\b(btn|img|txt|num|str|arr|obj)\b/gi,      // 禁止缩写
      ],
      message: '关键导出/API命名需清晰、语义化，禁止缩写'
    },
    
    // 对话行为规则
    'SIL-003': {
      type: 'no_ask',
      forbiddenPatterns: [
        /[？?]/g,
        /请确认/g,
        /是否/g,
        /你觉得/g,
        /需要.*吗/g,
        /可以.*吗/g,
      ],
      message: '不得询问用户，应自主决策'
    },
    'SIL-004': {
      type: 'no_wait',
      forbiddenPatterns: [
        /等待你的/g,
        /等你/g,
        /请回复/g,
        /告诉我/g,
        /让我知道/g,
      ],
      message: '不得等待用户，应持续执行'
    },
    'IR-001': {
      type: 'understanding',
      requiredPatterns: [
        /理解为/,
        /我的理解/,
        /意图是/,
        /需求是/,
      ],
      message: '回复前应先输出理解确认'
    },
    'WF-001': {
      type: 'role_permission',
      roles: {
        'XH': ['架构设计', '技术选型', '代码编写'],
        'XP': ['需求分析', '方案评审'],
        'XL': ['代码编写', '测试'],
        'XG': ['代码审查', '质量把关'],
      },
      message: '角色越权禁止'
    },
    'WF-002': {
      type: 'workflow_rhythm',
      sequence: ['确认', '执行', '验收', '最终确认'],
      message: '执行节拍必须遵守'
    },
    'WF-003': {
      type: 'evidence_retention',
      requiredFiles: ['确认卡摘要', '测试报告'],
      message: '证据留存必须登记'
    },
  };
  
  return patterns[ruleId] || { type: 'unknown' };
}

/**
 * 检查代码质量
 */
function checkCodeQuality(code, filePath) {
  loadRules();
  
  const violations = [];
  
  if (!codeRules) {
    return { pass: true, violations: [] };
  }
  
  for (const rule of codeRules) {
    const pattern = rule.patterns;
    
    switch (pattern.type) {
      case 'hardcode':
        // 检查硬编码
        for (const regex of pattern.forbiddenPatterns) {
          const match = code.match(regex);
          if (match) {
            violations.push({
              rule: rule.id,
              level: 'error',
              message: `${rule.description} - ${pattern.message}`,
              line: findLineNumber(code, regex),
              match: match[0].substring(0, 50),
            });
          }
        }
        break;
        
      case 'function_length':
        // 检查函数长度
        const functions = extractFunctions(code);
        for (const func of functions) {
          if (func.lines > pattern.maxLength) {
            violations.push({
              rule: rule.id,
              level: 'warn',
              message: `${rule.description} - 函数${func.name}有${func.lines}行（限制${pattern.maxLength}行）`,
              line: func.startLine,
            });
          }
        }
        break;
        
      case 'naming':
        // 检查命名规范
        if (pattern.patterns) {
          for (const regex of pattern.patterns) {
            if (regex.test(code)) {
              violations.push({
                rule: rule.id,
                level: 'warn',
                message: `${rule.description} - ${pattern.message}`,
                line: findLineNumber(code, regex),
              });
            }
          }
        }
        break;
    }
  }
  
  return {
    pass: violations.filter(v => v.level === 'error').length === 0,
    violations,
  };
}

/**
 * 检查对话行为
 */
function checkDialogueBehavior(message) {
  loadRules();
  
  const violations = [];
  
  if (!dialogueRules) {
    return { pass: true, violations: [] };
  }
  
  for (const rule of dialogueRules) {
    const pattern = rule.patterns;
    
    switch (pattern.type) {
      case 'no_ask':
        // 检查是否询问用户（排除确认卡中的合理使用）
        const hasConfirmCard = message.includes('## 确认') || message.includes('## 理解') || message.includes('## 方案');
        
        for (const regex of pattern.forbiddenPatterns) {
          const matches = message.match(regex);
          if (matches) {
            // 如果在确认卡中，检查是否是合理使用（例如"索引是否正确"是说明，不是询问）
            if (hasConfirmCard) {
              // 检查是否在确认点部分
              const confirmCardSection = message.split('##').find(section => 
                section.includes('确认') && section.includes(matches[0])
              );
              if (confirmCardSection) {
                // 在确认卡的确认点中，允许"是否"等词
                continue;
              }
            }
            
            // 其他情况视为询问用户
            violations.push({
              rule: rule.id,
              level: 'error',
              message: `${rule.description} - ${pattern.message}`,
              match: matches[0],
            });
          }
        }
        break;
        
      case 'no_wait':
        // 检查是否等待用户
        for (const regex of pattern.forbiddenPatterns) {
          if (regex.test(message)) {
            violations.push({
              rule: rule.id,
              level: 'error',
              message: `${rule.description} - ${pattern.message}`,
              match: message.match(regex)?.[0],
            });
          }
        }
        break;
        
      case 'understanding':
        // 检查是否有理解确认
        const hasUnderstanding = pattern.requiredPatterns.some(p => p.test(message));
        if (!hasUnderstanding) {
          violations.push({
            rule: rule.id,
            level: 'warn',
            message: `${rule.description} - ${pattern.message}`,
          });
        }
        break;
        
      case 'pre_execution_confirm':
        // 检查是否有确认卡
        const hasAllSections = pattern.requiredSections.every(section => 
          message.includes(section) || message.includes(`## ${section}`)
        );
        if (!hasAllSections) {
          violations.push({
            rule: rule.id,
            level: 'error',
            message: `${rule.description} - ${pattern.message}`,
            missing: pattern.requiredSections.filter(s => !message.includes(s)),
          });
        }
        break;
        
      case 'workflow_rhythm':
        // 检查执行节拍
        const hasSequence = checkSequence(message, pattern.sequence);
        if (!hasSequence) {
          violations.push({
            rule: rule.id,
            level: 'warn',
            message: `${rule.description} - ${pattern.message}`,
          });
        }
        break;
    }
  }
  
  return {
    pass: violations.filter(v => v.level === 'error').length === 0,
    violations,
  };
}

/**
 * 质量门禁检查
 */
function qualityGateCheck(changes) {
  const results = {
    codeQuality: [],
    dialogue: [],
    summary: {
      totalViolations: 0,
      errorCount: 0,
      warnCount: 0,
      pass: true,
    },
  };
  
  // 检查代码变更
  if (changes.code) {
    for (const file of changes.code) {
      const check = checkCodeQuality(file.content, file.path);
      if (!check.pass) {
        results.summary.pass = false;
      }
      results.codeQuality.push({
        file: file.path,
        ...check,
      });
    }
  }
  
  // 检查对话记录
  if (changes.messages) {
    for (const msg of changes.messages) {
      const check = checkDialogueBehavior(msg.content);
      if (!check.pass) {
        results.summary.pass = false;
      }
      results.dialogue.push({
        message: msg.content.substring(0, 100) + '...',
        ...check,
      });
    }
  }
  
  // 统计违规数量
  const allViolations = [
    ...results.codeQuality.flatMap(c => c.violations),
    ...results.dialogue.flatMap(d => d.violations),
  ];
  
  results.summary.totalViolations = allViolations.length;
  results.summary.errorCount = allViolations.filter(v => v.level === 'error').length;
  results.summary.warnCount = allViolations.filter(v => v.level === 'warn').length;
  
  return results;
}

// ============= 辅助函数 =============

function findLineNumber(code, regex) {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      return i + 1;
    }
  }
  return 1;
}

function extractFunctions(code) {
  const functions = [];
  const lines = code.split('\n');
  let currentFunc = null;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检测函数开始
    const funcMatch = line.match(/function\s+(\w+)|const\s+(\w+)\s*=.*=>/);
    if (funcMatch && !currentFunc) {
      currentFunc = {
        name: funcMatch[1] || funcMatch[2],
        startLine: i + 1,
        lines: 0,
      };
    }
    
    if (currentFunc) {
      currentFunc.lines++;
      
      // 计算大括号
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      // 函数结束
      if (braceCount === 0 && currentFunc.lines > 1) {
        functions.push(currentFunc);
        currentFunc = null;
      }
    }
  }
  
  return functions;
}

function checkSequence(text, sequence) {
  let lastIndex = -1;
  for (const keyword of sequence) {
    const index = text.indexOf(keyword, lastIndex + 1);
    if (index === -1 || index <= lastIndex) {
      return false;
    }
    lastIndex = index;
  }
  return true;
}

// ============= API路由 =============

/**
 * API 1: 检查代码质量
 */
app.post('/api/check-code', (req, res) => {
  const startTime = Date.now();
  const { code, filePath } = req.body;
  
  if (!code) {
    monitor.logApiCall('/api/check-code', 'POST', 0, 400, false, new Error('缺少code参数'));
    return res.status(400).json({ error: '缺少code参数' });
  }
  
  try {
    const result = checkCodeQuality(code, filePath || 'unknown');
    const duration = Date.now() - startTime;
    
    // 记录规则检查
    if (codeRules && codeRules.rules) {
      codeRules.rules.forEach(rule => {
        const ruleViolations = result.violations.filter(v => v.rule === rule.id);
        monitor.logRuleCheck(rule.id, code, { pass: result.pass, violations: ruleViolations }, duration);
      });
    }
    
    // 记录API调用
    monitor.logApiCall('/api/check-code', 'POST', duration, 200, true);
    
    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    monitor.logError('rule-engine', error, { endpoint: '/api/check-code', filePath });
    monitor.logApiCall('/api/check-code', 'POST', duration, 500, false, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 2: 检查对话行为
 */
app.post('/api/check-dialogue', (req, res) => {
  const startTime = Date.now();
  const { message } = req.body;
  
  if (!message) {
    monitor.logApiCall('/api/check-dialogue', 'POST', 0, 400, false, new Error('缺少message参数'));
    return res.status(400).json({ error: '缺少message参数' });
  }
  
  try {
    // 1. 检查连续执行模式
    const continuousCheck = continuousMode.checkAndBlockQuestions(message);
    
    let result = checkDialogueBehavior(message);
    
    // 2. 如果连续模式启用，添加增强提示词
    if (continuousMode.isEnabled()) {
      const enhancedPrompt = continuousMode.getEnhancedPrompt();
      result.enhancedPrompt = enhancedPrompt;
      result.continuousModeActive = true;
    }
    
    // 3. 如果连续模式拦截了询问，添加违规
    if (continuousCheck.shouldBlock) {
      result.pass = false;
      result.violations.push({
        rule: 'CONTINUOUS-MODE',
        level: 'error',
        message: continuousCheck.reason,
        suggestion: continuousCheck.suggestion
      });
    }
    
    // 4. 自动记录经验（异步，不阻塞）
    experienceLogger.autoDetectAndLog(message, { source: 'dialogue-check' }, null)
      .catch(err => console.error('[经验记录] 自动记录失败:', err.message));
    
    const duration = Date.now() - startTime;
    
    // 记录对话检查
    if (dialogueRules && dialogueRules.length > 0) {
      dialogueRules.forEach(rule => {
        const ruleViolations = result.violations.filter(v => v.rule === rule.id);
        monitor.logRuleCheck(rule.id, message, { pass: result.pass, violations: ruleViolations }, duration);
      });
    }
    
    // 记录API调用
    monitor.logApiCall('/api/check-dialogue', 'POST', duration, 200, true);
    
    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    monitor.logError('rule-engine', error, { endpoint: '/api/check-dialogue' });
    monitor.logApiCall('/api/check-dialogue', 'POST', duration, 500, false, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 3: 质量门禁
 */
app.post('/api/quality-gate', (req, res) => {
  const { changes } = req.body;
  
  if (!changes) {
    return res.status(400).json({ error: '缺少changes参数' });
  }
  
  const result = qualityGateCheck(changes);
  res.json(result);
});

/**
 * API 4: 重新加载规则
 */
app.post('/api/reload-rules', (req, res) => {
  loadRules(true);
  res.json({ success: true, message: '规则重新加载成功' });
});

/**
 * API 5: 健康检查
 */
app.get('/api/health', (req, res) => {
  const startTime = Date.now();
  
  try {
    const duration = Date.now() - startTime;
    
    const health = {
      status: 'ok',
      codeRules: codeRules?.length || 0,
      dialogueRules: dialogueRules?.length || 0,
      uptime: process.uptime(),
    };
    
    // 记录健康检查
    monitor.logHealthCheck('rule-engine', 'healthy', {
      codeRules: health.codeRules,
      dialogueRules: health.dialogueRules,
      uptime: health.uptime,
      duration
    });
    
    res.json(health);
  } catch (error) {
    const duration = Date.now() - startTime;
    monitor.logHealthCheck('rule-engine', 'unhealthy', { error: error.message, duration });
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ============= 连续执行模式API =============

/**
 * API 6: 启动连续执行模式
 */
app.post('/api/continuous-mode/enable', (req, res) => {
  const { taskDescription } = req.body;
  
  if (!taskDescription) {
    return res.status(400).json({ error: '缺少taskDescription参数' });
  }
  
  try {
    const result = continuousMode.enable(taskDescription);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 7: 停止连续执行模式
 */
app.post('/api/continuous-mode/disable', (req, res) => {
  try {
    const result = continuousMode.disable();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 8: 获取连续执行模式状态
 */
app.get('/api/continuous-mode/status', (req, res) => {
  try {
    const status = continuousMode.getStatusInfo();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API 9: 重置连续执行模式
 */
app.post('/api/continuous-mode/reset', (req, res) => {
  try {
    const result = continuousMode.reset();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 索引注册API ====================

/**
 * 构建索引
 */
app.post('/api/index/build', async (req, res) => {
  try {
    const result = await indexRegistry.buildIndex();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 搜索文件
 */
app.get('/api/index/search', async (req, res) => {
  const { query, category = 'all', limit = 10 } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: '缺少query参数' });
  }
  
  try {
    const result = await indexRegistry.searchFiles(query, category, parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 记录决策
 */
app.post('/api/index/decision', async (req, res) => {
  const { queries, targetAction, targetFiles, reason } = req.body;
  
  if (!targetAction) {
    return res.status(400).json({ error: '缺少targetAction参数' });
  }
  
  try {
    const result = await indexRegistry.recordDecision(queries, targetAction, targetFiles, reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取状态
 */
app.get('/api/index/status', async (req, res) => {
  try {
    const result = await indexRegistry.getStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取文件详情
 */
app.get('/api/index/file', async (req, res) => {
  const { path: filePath } = req.query;
  
  if (!filePath) {
    return res.status(400).json({ error: '缺少path参数' });
  }
  
  try {
    const result = await indexRegistry.getFileDetails(filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取推荐文件
 */
app.get('/api/index/recommendations', async (req, res) => {
  const { file, limit = 5 } = req.query;
  
  if (!file) {
    return res.status(400).json({ error: '缺少file参数' });
  }
  
  try {
    const result = await indexRegistry.getRecommendations(file, parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 经验记录API ====================

/**
 * 手动记录经验
 */
app.post('/api/experience/log', async (req, res) => {
  const { type, description, solution, context, ruleId } = req.body;
  
  if (!type || !description) {
    return res.status(400).json({ error: '缺少type或description参数' });
  }
  
  try {
    const entry = new experienceLogger.ExperienceEntry(type, description, solution, context, ruleId);
    
    if (type === 'error') {
      await experienceLogger.logError(entry);
    } else if (type === 'success') {
      await experienceLogger.logSuccess(entry);
    } else {
      return res.status(400).json({ error: 'type必须是error或success' });
    }
    
    res.json({ success: true, message: '经验已记录' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 搜索经验
 */
app.get('/api/experience/search', async (req, res) => {
  const { keyword, type = 'all' } = req.query;
  
  if (!keyword) {
    return res.status(400).json({ error: '缺少keyword参数' });
  }
  
  try {
    const results = await experienceLogger.searchExperience(keyword, type);
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取统计信息
 */
app.get('/api/experience/stats', async (req, res) => {
  try {
    const stats = await experienceLogger.getStatistics();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== GUI测试API ====================

/**
 * 运行GUI测试
 */
app.post('/api/gui-test/run', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { appType, appPath, rounds = 5 } = req.body;
    
    if (!appType || !appPath) {
      return res.status(400).json({ 
        error: '缺少必需参数', 
        required: { appType: 'web|desktop', appPath: 'URL或路径' }
      });
    }
    
    // 检查GUI测试规则
    loadRules();
    const ir020 = guiTestingRules?.find(r => r.id === 'IR-020');
    const ir021 = guiTestingRules?.find(r => r.id === 'IR-021');
    
    const runner = new GUITestRunner();
    const results = await runner.run5RoundsTest(appType, appPath, rounds);
    
    // 验证三重验证
    const tripleVerificationPassed = results.every(r => 
      r.verification.screenshot && 
      r.verification.logs && 
      r.verification.execution
    );
    
    // 验证5轮测试
    const fiveRoundsPassed = results.length >= 5 && tripleVerificationPassed;
    
    const duration = Date.now() - startTime;
    
    // 记录监管日志
    monitor.logCustomEvent('gui_test', {
      appType,
      appPath,
      rounds: results.length,
      tripleVerificationPassed,
      fiveRoundsPassed,
      duration
    }, tripleVerificationPassed && fiveRoundsPassed ? 'info' : 'warning');
    
    // 保存报告
    const reportPath = await runner.saveReport();
    
    res.json({
      success: true,
      results: {
        total: results.length,
        passed: results.filter(r => r.verification.screenshot && r.verification.logs && r.verification.execution).length,
        tripleVerificationPassed,
        fiveRoundsPassed,
        reportPath,
        duration
      },
      details: results
    });
    
  } catch (error) {
    monitor.logError('gui-test-api', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取GUI测试规则
 */
app.get('/api/gui-test/rules', (req, res) => {
  loadRules();
  res.json({
    success: true,
    count: guiTestingRules?.length || 0,
    rules: guiTestingRules || []
  });
});

// ========== 四角色系统 API（v6.1 新增）==========

/**
 * API: 执行5轮GUI测试（新）
 */
app.post('/api/v61/gui-test/5rounds', async (req, res) => {
  try {
    const testConfig = req.body;
    const runner = new GUITestRunnerV61();
    
    const result = await runner.run5RoundsTest(testConfig);
    const report = runner.generateReport(result);
    
    res.json({
      success: result.pass,
      result: report
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 技能库 - 记录成功经验（新）
 */
app.post('/api/v61/skills/record', async (req, res) => {
  try {
    const library = new SkillLibrary();
    const skill = await library.recordSuccess(req.body);
    
    res.json({
      success: true,
      skill
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 技能库 - 搜索解决方案（新）
 */
app.get('/api/v61/skills/search', async (req, res) => {
  try {
    const { problem, minScore } = req.query;
    const library = new SkillLibrary();
    
    const solutions = await library.findSolution(problem, parseFloat(minScore) || 0.5);
    
    res.json({
      success: true,
      count: solutions.length,
      solutions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 技能库 - 检查失败方法（新）
 */
app.post('/api/v61/skills/check-failure', async (req, res) => {
  try {
    const { solution, context } = req.body;
    const library = new SkillLibrary();
    
    const check = await library.checkIfFailedBefore(solution, context);
    
    res.json({
      success: true,
      check
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 确认卡 - 检查（新）
 */
app.post('/api/v61/confirmation/check', (req, res) => {
  try {
    const { message } = req.body;
    const confirmation = new DialogueConfirmation();
    
    const result = confirmation.checkConfirmationCard(message);
    
    res.json({
      success: result.pass,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 确认卡 - 生成模板（新）
 */
app.post('/api/v61/confirmation/template', (req, res) => {
  try {
    const { userRequest } = req.body;
    const confirmation = new DialogueConfirmation();
    
    const template = confirmation.generateTemplate(userRequest);
    
    res.json({
      success: true,
      template
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 循环防护 - 检查代码（新）
 */
app.post('/api/v61/loop/check', (req, res) => {
  try {
    const { code } = req.body;
    const protection = new LoopProtection();
    
    const result = protection.checkLoopCode(code);
    
    res.json({
      success: result.pass,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 循环防护 - 自动修复（新）
 */
app.post('/api/v61/loop/fix', (req, res) => {
  try {
    const { code, timeout } = req.body;
    const protection = new LoopProtection();
    
    const fixedCode = protection.addTimeoutProtection(code, timeout || 30000);
    
    res.json({
      success: true,
      original: code,
      fixed: fixedCode
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 角色管理 - 检测角色（新）
 */
app.post('/api/v61/role/detect', (req, res) => {
  try {
    const { message, context } = req.body;
    const manager = new RoleManager();
    
    const role = manager.detectRole(message, context || {});
    const roleInfo = manager.roles[role];
    
    res.json({
      success: true,
      detectedRole: role,
      roleInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 角色管理 - 生成角色声明（新）
 */
app.post('/api/v61/role/declaration', (req, res) => {
  try {
    const { roleKey } = req.body;
    const manager = new RoleManager();
    
    const declaration = manager.generateRoleDeclaration(roleKey);
    
    res.json({
      success: true,
      declaration
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 会议引擎 - 触发会议（新）
 */
app.post('/api/v61/meeting/trigger', async (req, res) => {
  try {
    const issue = req.body;
    const engine = new MeetingEngine();
    
    const result = await engine.triggerMeeting(issue);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 版本查询 - SYS-012
 */
app.get('/api/version', (req, res) => {
  try {
    const versionManager = new VersionManager();
    const versionData = versionManager.getVersionData();
    
    if (!versionData) {
      return res.status(500).json({ 
        error: '无法读取版本信息' 
      });
    }
    
    // 计算运行时间
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeStr = `${hours}h ${minutes}m`;
    
    res.json({
      version: versionData.version,
      release_date: versionData.release_date,
      update_summary: versionData.update_summary,
      previous_version: versionData.previous_version,
      is_latest: true,
      uptime: uptimeStr,
      statistics: versionData.statistics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 自我介绍 - 响应"你是谁"等问题
 */
try {
  console.log('[DEBUG] 注册 /api/intro 路由...');
  app.get('/api/intro', (req, res) => {
    try {
      const type = req.query.type || 'full';
      const intro = new SelfIntroduction();
      
      let response;
      
      switch (type) {
        case 'short':
          response = { text: intro.getShortIntro() };
          break;
        case 'team':
          response = { text: intro.getTeamIntro() };
          break;
        case 'version':
          response = { text: intro.getVersionInfo() };
          break;
        case 'json':
          response = intro.getTeamConfig();
          break;
        default:
          response = { text: intro.getFullIntro() };
      }
      
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  console.log('[DEBUG] /api/intro 路由注册成功');
} catch (error) {
  console.error('[ERROR] 注册 /api/intro 失败:', error.message);
}

/**
 * API: 获取团队配置
 */
try {
  console.log('[DEBUG] 注册 /api/team/config 路由...');
  app.get('/api/team/config', (req, res) => {
    try {
      const intro = new SelfIntroduction();
      res.json(intro.getTeamConfig());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  console.log('[DEBUG] /api/team/config 路由注册成功');
} catch (error) {
  console.error('[ERROR] 注册 /api/team/config 失败:', error.message);
}

/**
 * API: 获取角色信息
 */
try {
  console.log('[DEBUG] 注册 /api/team/role/:roleKey 路由...');
  app.get('/api/team/role/:roleKey', (req, res) => {
    try {
      const { roleKey } = req.params;
      const intro = new SelfIntroduction();
      const roleInfo = intro.getRoleInfo(roleKey);
      
      res.json({ role: roleInfo });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  console.log('[DEBUG] /api/team/role/:roleKey 路由注册成功');
} catch (error) {
  console.error('[ERROR] 注册 /api/team/role/:roleKey 失败:', error.message);
}

/**
 * API: 会议引擎 - 获取会议历史（新）
 */
app.get('/api/v61/meeting/history', (req, res) => {
  try {
    const engine = new MeetingEngine();
    const history = engine.getMeetingHistory();
    
    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: 会议引擎 - 获取统计（新）
 */
app.get('/api/v61/meeting/stats', (req, res) => {
  try {
    const engine = new MeetingEngine();
    const stats = engine.getStatistics();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// ========== 导出（保持不变）==========
module.exports = { checkCodeQuality, checkDialogueBehavior, qualityGateCheck };

// ========== 服务启动函数 ==========
function startServer() {
  // 加载规则
  loadRules(true);
  
  // 初始化经验记录器
  experienceLogger.initialize(path.join(__dirname, '..'));
  
  // 初始化索引注册器
  indexRegistry.initialize(path.join(__dirname, '..'));
  
  // 启动服务器
  const server = app.listen(PORT, () => {
    const versionManager = new VersionManager();
    console.log('');
    versionManager.displayBanner();
    console.log('');
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           规则引擎服务启动成功                              ║
║                                                           ║
║  端口: ${PORT}                                             ║
║  代码质量规则: ${(codeRules?.length || 0).toString().padEnd(3)} 条                                    ║
║  对话行为规则: ${(dialogueRules?.length || 0).toString().padEnd(3)} 条                                    ║
║  GUI测试规则: ${(guiTestingRules?.length || 0).toString().padEnd(3)} 条                                    ║
║                                                           ║
║  核心API:                                                 ║
║    POST /api/check-code       - 检查代码质量               ║
║    POST /api/check-dialogue   - 检查对话行为               ║
║    POST /api/quality-gate     - 质量门禁                  ║
║    GET  /api/version         - 版本信息                   ║
║    GET  /api/health          - 健康检查                   ║
║                                                           ║
║  自我介绍 (NEW! 🎉):                                      ║
║    GET  /api/intro           - 自我介绍                   ║
║    GET  /api/team/config     - 团队配置                   ║
║    GET  /api/team/role/:key  - 角色信息                   ║
║                                                           ║
║  连续执行模式:                                             ║
║    POST /api/continuous-mode/enable   - 启动               ║
║    POST /api/continuous-mode/disable  - 停止               ║
║    GET  /api/continuous-mode/status   - 状态               ║
║                                                           ║
║  经验记录:                                                 ║
║    POST /api/experience/log     - 记录经验                 ║
║    GET  /api/experience/search  - 搜索经验                 ║
║    GET  /api/experience/stats   - 统计信息                 ║
║                                                           ║
║  索引注册:                                                 ║
║    POST /api/index/build         - 构建索引                ║
║    GET  /api/index/search        - 搜索文件                ║
║    POST /api/index/decision      - 记录决策                ║
║    GET  /api/index/status        - 获取状态                ║
║    GET  /api/index/file          - 文件详情                ║
║    GET  /api/index/recommendations - 推荐文件              ║
║                                                           ║
║  GUI测试:                                                 ║
║    POST /api/gui-test/run    - 运行GUI测试                 ║
║    GET  /api/gui-test/rules  - 获取GUI测试规则             ║
║                                                           ║
║  目标执行率: 95%                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    console.log(`[规则引擎] 服务已启动`);
    console.log(`[规则引擎] 自我介绍API: GET http://localhost:${PORT}/api/intro?type=short`);
    console.log(`[规则引擎] 团队配置API: GET http://localhost:${PORT}/api/team/config`);
    console.log('');
  });
  
  return server;
}

// ========== 自动启动 ==========
// 无论是PM2还是直接运行，都启动服务
startServer();

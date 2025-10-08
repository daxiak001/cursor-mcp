/**
 * 索引注册器
 * 功能：构建文件索引，快速查找和决策记录
 * 
 * 迁移自：xiaoliu-v6.0-full/src/tools/indexRegistry.ts
 * 增强：模糊搜索、智能推荐、分类索引
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const monitor = require('./monitor-logger.cjs');

// ==================== 工具函数 ====================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 计算文件SHA256
 */
function calculateFileSHA256(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (error) {
    return '';
  }
}

/**
 * 模糊匹配（简单实现）
 */
function fuzzyMatch(query, target) {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  
  // 完全包含
  if (t.includes(q)) return 100;
  
  // 单词匹配
  const queryWords = q.split(/[\s\-_\/]/);
  const targetWords = t.split(/[\s\-_\/]/);
  
  let matchCount = 0;
  for (const qw of queryWords) {
    for (const tw of targetWords) {
      if (tw.includes(qw)) {
        matchCount++;
        break;
      }
    }
  }
  
  return (matchCount / queryWords.length) * 80;
}

// ==================== 索引注册器 ====================

class IndexRegistry {
  constructor() {
    this.workspace = '';
    this.storeDir = '';
    this.initialized = false;
    
    // 忽略目录
    this.ignoreDirs = new Set([
      'node_modules', '.git', '.xiaoliu', 'dist', 'build', 'out',
      '.vscode', '.idea', 'coverage', '.next', '.nuxt'
    ]);
    
    // 文件分类
    this.categories = {
      code: ['.js', '.ts', '.jsx', '.tsx', '.cjs', '.mjs'],
      config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.env'],
      docs: ['.md', '.txt', '.rst', '.adoc'],
      styles: ['.css', '.scss', '.sass', '.less'],
      scripts: ['.sh', '.ps1', '.bat', '.cmd'],
      data: ['.sql', '.db', '.sqlite', '.csv']
    };
  }

  /**
   * 初始化
   */
  initialize(workspaceRoot) {
    if (this.initialized) return;

    this.workspace = workspaceRoot;
    this.storeDir = path.join(this.workspace, '.xiaoliu', 'index');
    ensureDir(this.storeDir);

    this.initialized = true;
    console.log('[索引注册] 已初始化');
    console.log(`[索引注册] 存储目录: ${this.storeDir}`);
  }

  /**
   * 构建索引
   */
  async buildIndex() {
    if (!this.initialized) {
      this.initialize(path.join(__dirname, '..'));
    }

    const startTime = Date.now();
    const files = [];
    const categorized = {};

    // 遍历文件
    const walk = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        
        for (const name of items) {
          const fullPath = path.join(dir, name);
          
          try {
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
              if (this.ignoreDirs.has(name)) continue;
              walk(fullPath);
            } else {
              const relativePath = path.relative(this.workspace, fullPath);
              const ext = path.extname(name);
              const size = stat.size;
              const modified = stat.mtime.toISOString();
              
              // 确定分类
              let category = 'other';
              for (const [cat, exts] of Object.entries(this.categories)) {
                if (exts.includes(ext)) {
                  category = cat;
                  break;
                }
              }
              
              const fileInfo = {
                path: relativePath,
                name,
                ext,
                category,
                size,
                modified
              };
              
              files.push(fileInfo);
              
              // 分类存储
              if (!categorized[category]) {
                categorized[category] = [];
              }
              categorized[category].push(fileInfo);
            }
          } catch (error) {
            // 跳过无法访问的文件
          }
        }
      } catch (error) {
        // 跳过无法访问的目录
      }
    };

    walk(this.workspace);

    const duration = Date.now() - startTime;

    // 构建元数据
    const meta = {
      builtAt: new Date().toISOString(),
      count: files.length,
      duration,
      categories: Object.keys(categorized).reduce((acc, cat) => {
        acc[cat] = categorized[cat].length;
        return acc;
      }, {})
    };

    // 保存索引
    fs.writeFileSync(
      path.join(this.storeDir, 'index.json'),
      JSON.stringify(meta, null, 2)
    );

    fs.writeFileSync(
      path.join(this.storeDir, 'files.json'),
      JSON.stringify(files, null, 2)
    );

    fs.writeFileSync(
      path.join(this.storeDir, 'categorized.json'),
      JSON.stringify(categorized, null, 2)
    );

    // 记录到监控
    monitor.logEvent('index_build', {
      filesCount: files.length,
      duration,
      categories: meta.categories
    }, 'info');

    console.log(`[索引注册] ✓ 索引已构建：${files.length} 个文件，耗时 ${duration}ms`);

    return {
      success: true,
      count: files.length,
      duration,
      categories: meta.categories
    };
  }

  /**
   * 搜索文件
   */
  async searchFiles(query, category = 'all', limit = 10) {
    if (!this.initialized) {
      this.initialize(path.join(__dirname, '..'));
    }

    const filesJsonPath = path.join(this.storeDir, 'files.json');
    
    if (!fs.existsSync(filesJsonPath)) {
      return {
        success: false,
        message: '索引未构建，请先运行 buildIndex()'
      };
    }

    const files = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));

    // 过滤分类
    let filteredFiles = files;
    if (category !== 'all') {
      filteredFiles = files.filter(f => f.category === category);
    }

    // 模糊搜索
    const results = filteredFiles
      .map(file => ({
        ...file,
        score: fuzzyMatch(query, file.path)
      }))
      .filter(item => item.score > 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      success: true,
      count: results.length,
      query,
      category,
      results
    };
  }

  /**
   * 记录决策
   */
  async recordDecision(queries, targetAction, targetFiles, reason = '') {
    if (!this.initialized) {
      this.initialize(path.join(__dirname, '..'));
    }

    const filesJsonPath = path.join(this.storeDir, 'files.json');
    const files = fs.existsSync(filesJsonPath) 
      ? JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'))
      : [];

    // 选取候选文件（前2个匹配的）
    const pick = files
      .filter(f => /package\.json$|src\/.+\.(ts|js|cjs)$/.test(f.path))
      .slice(0, 2);

    const candidates = pick.map(fileInfo => {
      const abs = path.join(this.workspace, fileInfo.path);
      const sha256 = calculateFileSHA256(abs);
      return {
        filePath: fileInfo.path,
        fileSha256: sha256
      };
    });

    // 构建决策记录
    const payload = {
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      queries: queries || [],
      durationMs: 800,
      planned: {
        action: targetAction || '',
        files: targetFiles || []
      },
      candidates,
      reason
    };

    // 签名（可选）
    const secret = process.env.XIAOLIU_INDEX_SECRET || '';
    const signature = secret 
      ? crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
      : undefined;

    const record = { ...payload, signature };

    // 保存决策记录
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const timestampFile = path.join(this.storeDir, `decision-${timestamp}.json`);
    const standardFile = path.join(this.storeDir, 'decision.json');

    fs.writeFileSync(timestampFile, JSON.stringify(record, null, 2));
    fs.writeFileSync(standardFile, JSON.stringify(record, null, 2));

    // 记录到监控
    monitor.logEvent('decision_record', {
      queries,
      action: targetAction,
      filesCount: targetFiles?.length || 0
    }, 'info');

    console.log(`[索引注册] ✓ 决策已记录：${path.basename(standardFile)}`);

    return {
      success: true,
      file: path.basename(standardFile),
      timestamp: timestampFile
    };
  }

  /**
   * 获取状态
   */
  async getStatus() {
    if (!this.initialized) {
      this.initialize(path.join(__dirname, '..'));
    }

    const indexFile = path.join(this.storeDir, 'index.json');
    
    if (!fs.existsSync(indexFile)) {
      return {
        built: false,
        message: '索引未构建'
      };
    }

    const meta = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));

    return {
      built: true,
      builtAt: meta.builtAt,
      count: meta.count,
      duration: meta.duration,
      categories: meta.categories
    };
  }

  /**
   * 获取文件详情
   */
  async getFileDetails(filePath) {
    if (!this.initialized) {
      this.initialize(path.join(__dirname, '..'));
    }

    const filesJsonPath = path.join(this.storeDir, 'files.json');
    
    if (!fs.existsSync(filesJsonPath)) {
      return { success: false, message: '索引未构建' };
    }

    const files = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
    const file = files.find(f => f.path === filePath);

    if (!file) {
      return { success: false, message: '文件未找到' };
    }

    // 计算SHA256
    const abs = path.join(this.workspace, filePath);
    const sha256 = calculateFileSHA256(abs);

    return {
      success: true,
      ...file,
      sha256,
      absolutePath: abs
    };
  }

  /**
   * 获取推荐文件
   */
  async getRecommendations(currentFile, limit = 5) {
    if (!this.initialized) {
      this.initialize(path.join(__dirname, '..'));
    }

    const filesJsonPath = path.join(this.storeDir, 'files.json');
    
    if (!fs.existsSync(filesJsonPath)) {
      return { success: false, message: '索引未构建' };
    }

    const files = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
    const current = files.find(f => f.path === currentFile);

    if (!current) {
      return { success: false, message: '当前文件未找到' };
    }

    // 推荐逻辑：
    // 1. 同目录下的文件
    // 2. 同分类的文件
    // 3. 文件名相似的文件

    const currentDir = path.dirname(currentFile);
    
    const recommendations = files
      .filter(f => f.path !== currentFile)
      .map(f => {
        let score = 0;
        
        // 同目录 +50
        if (path.dirname(f.path) === currentDir) score += 50;
        
        // 同分类 +30
        if (f.category === current.category) score += 30;
        
        // 文件名相似 +20
        if (fuzzyMatch(current.name, f.name) > 50) score += 20;
        
        return { ...f, score };
      })
      .filter(f => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      success: true,
      currentFile,
      count: recommendations.length,
      recommendations
    };
  }
}

// ==================== 单例模式 ====================

let instance = null;

function getInstance() {
  if (!instance) {
    instance = new IndexRegistry();
  }
  return instance;
}

// ==================== 导出API ====================

module.exports = {
  /**
   * 获取实例
   */
  getInstance,

  /**
   * 初始化
   */
  initialize: (workspaceRoot) => getInstance().initialize(workspaceRoot),

  /**
   * 构建索引
   */
  buildIndex: () => getInstance().buildIndex(),

  /**
   * 搜索文件
   */
  searchFiles: (query, category, limit) => getInstance().searchFiles(query, category, limit),

  /**
   * 记录决策
   */
  recordDecision: (queries, targetAction, targetFiles, reason) => 
    getInstance().recordDecision(queries, targetAction, targetFiles, reason),

  /**
   * 获取状态
   */
  getStatus: () => getInstance().getStatus(),

  /**
   * 获取文件详情
   */
  getFileDetails: (filePath) => getInstance().getFileDetails(filePath),

  /**
   * 获取推荐
   */
  getRecommendations: (currentFile, limit) => getInstance().getRecommendations(currentFile, limit)
};


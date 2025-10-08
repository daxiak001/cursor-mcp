/**
 * 中文分词优化模块
 * 
 * 功能：
 * 1. 中文智能分词（不依赖外部库，纯JS实现）
 * 2. 关键词提取优化
 * 3. 同义词扩展
 * 4. 专业术语识别
 * 
 * 优先级：P1 - 重要改进
 * 说明：由于nodejieba需要编译，采用纯JS实现避免依赖问题
 * 预期效果：提升中文关键词提取准确率30%+
 */

const fs = require('fs');
const path = require('path');

class ChineseSegmenter {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      maxKeywords: config.maxKeywords || 50,
      minKeywordLength: config.minKeywordLength || 2,
      enableSynonyms: config.enableSynonyms !== false,
      enableTechnicalTerms: config.enableTechnicalTerms !== false,
      logEnabled: config.logEnabled !== false
    };
    
    // 停用词表
    this.stopWords = new Set([
      '的', '了', '和', '是', '在', '有', '我', '不', '这', '那', '你', '们',
      '个', '上', '也', '就', '要', '会', '为', '着', '能', '可以', '都',
      '他', '她', '它', '我们', '你们', '他们', '自己', '什么', '怎么',
      '这个', '那个', '这里', '那里', '这样', '那样', '如何', '为什么',
      'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'should', 'could', 'may', 'might', 'can'
    ]);
    
    // 技术术语词典（IT/编程相关）
    this.technicalTerms = new Set([
      // 编程语言
      'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust',
      'PHP', 'Ruby', 'Swift', 'Kotlin', 'Scala', 'Dart', 'R', 'MATLAB',
      
      // 框架和库
      'React', 'Vue', 'Angular', 'Django', 'Flask', 'Spring', 'Express',
      'FastAPI', 'Next.js', 'Nuxt.js', 'Laravel', 'Rails', 'ASP.NET',
      
      // 数据库
      'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle',
      'MariaDB', 'Cassandra', 'Elasticsearch', 'DynamoDB',
      
      // 开发工具
      'Git', 'Docker', 'Kubernetes', 'Jenkins', 'Travis CI', 'GitHub Actions',
      'VSCode', 'IntelliJ', 'Postman', 'Swagger',
      
      // 架构模式
      'MVC', 'MVVM', 'MVP', 'REST', 'GraphQL', 'gRPC', 'WebSocket',
      'Microservices', 'Serverless', 'Event-Driven',
      
      // 测试
      'Jest', 'Mocha', 'Pytest', 'JUnit', 'Selenium', 'Cypress', 'Playwright',
      
      // 中文术语
      '前端', '后端', '全栈', '数据库', '服务器', '客户端', '接口',
      '模型', '视图', '控制器', '路由', '中间件', '拦截器', '过滤器',
      '缓存', '队列', '消息', '事件', '监听', '触发', '回调', '异步',
      '同步', '并发', '并行', '线程', '进程', '协程', '锁', '事务',
      '用户', '认证', '授权', '权限', '角色', '登录', '注册', '登出',
      '加密', '解密', '哈希', '令牌', 'Token', 'JWT', 'Session', 'Cookie',
      '前端开发', '后端开发', '全栈开发', 'Web开发', '移动开发',
      '测试', '单元测试', '集成测试', '端到端测试', 'E2E测试',
      '性能', '优化', '重构', '部署', '上线', '回滚', '监控',
      '日志', '调试', '错误', '异常', '捕获', '抛出', '处理',
      'API', 'SDK', 'CLI', 'GUI', 'UI', 'UX', 'HTTP', 'HTTPS', 'TCP', 'UDP',
      'JSON', 'XML', 'YAML', 'SQL', 'NoSQL', 'ORM', 'ODM'
    ]);
    
    // 同义词映射
    this.synonyms = {
      '创建': ['生成', '建立', '新建', '构建', '制作'],
      '实现': ['完成', '开发', '编写', '实施'],
      '优化': ['改进', '提升', '增强', '改善'],
      '修复': ['解决', '修正', '调试', '修改'],
      '测试': ['验证', '检查', '检验', '测验'],
      '部署': ['发布', '上线', '安装', '配置'],
      '删除': ['移除', '清除', '去掉', '删掉'],
      '更新': ['升级', '修改', '变更', '更改'],
      '查询': ['检索', '搜索', '查找', '获取'],
      '添加': ['增加', '插入', '加入', '新增'],
      
      // 技术同义词
      '数据库': ['DB', '数据存储', '持久化'],
      '接口': ['API', '端点', 'Endpoint'],
      '前端': ['客户端', 'Frontend', 'UI'],
      '后端': ['服务端', 'Backend', 'Server'],
      '用户': ['账户', '账号', 'User'],
      '登录': ['登陆', '签到', 'Login'],
      '注册': ['注冊', '注冊', 'Register', 'SignUp'],
      '权限': ['授权', '许可', 'Permission', 'Authorization']
    };
    
    // 专业领域词库
    this.domainDictionaries = {
      'gui_testing': new Set([
        'GUI', '图形界面', '用户界面', 'UI测试', '自动化测试', 'Selenium',
        'Playwright', 'PyAutoGUI', '鼠标', '键盘', '点击', '输入', '截图',
        '元素定位', 'XPath', 'CSS选择器', '窗口', '对话框', '按钮', '文本框',
        '下拉框', '复选框', '单选按钮', '菜单', '标签页', '滚动', '拖拽'
      ]),
      'web_dev': new Set([
        'HTML', 'CSS', 'JavaScript', 'DOM', 'BOM', 'Ajax', 'Fetch',
        '响应式', '移动端', 'PC端', '浏览器', '兼容性', 'Webpack', 'Babel',
        'npm', 'yarn', 'pnpm', '组件', 'Props', 'State', 'Hooks', 'Context'
      ]),
      'backend_dev': new Set([
        'HTTP', 'RESTful', 'GraphQL', 'gRPC', 'WebSocket', 'MQ', '消息队列',
        'Redis', 'MySQL', 'PostgreSQL', 'MongoDB', 'ORM', '连接池',
        '事务', 'ACID', 'CAP', 'BASE', '分布式', '微服务', '容器', 'Docker'
      ])
    };
    
    // 常见词组（提高识别准确率）
    this.commonPhrases = [
      '用户认证', '数据库设计', 'API接口', '前端开发', '后端开发',
      '测试用例', '代码审查', '性能优化', '错误处理', '日志记录',
      '权限管理', '角色控制', '数据验证', '表单验证', '文件上传',
      '图片处理', '邮件发送', '短信验证', '第三方登录', '支付接口',
      '订单系统', '购物车', '商品管理', '库存管理', '物流跟踪',
      '用户管理', '内容管理', '评论系统', '搜索功能', '推荐系统',
      '数据分析', '报表生成', '导出功能', '导入功能', '批量操作',
      '定时任务', '异步任务', '队列处理', '缓存策略', '负载均衡'
    ];
  }
  
  /**
   * 中文分词（主入口）
   */
  segment(text) {
    if (!text || typeof text !== 'string') return [];
    
    const words = [];
    
    // 1. 提取词组（优先）
    words.push(...this.extractPhrases(text));
    
    // 2. 提取技术术语
    if (this.config.enableTechnicalTerms) {
      words.push(...this.extractTechnicalTerms(text));
    }
    
    // 3. 基础分词
    words.push(...this.basicSegment(text));
    
    // 4. 去重和过滤
    const filtered = this.filterWords(words);
    
    // 5. 同义词扩展（可选）
    const expanded = this.config.enableSynonyms 
      ? this.expandSynonyms(filtered)
      : filtered;
    
    return expanded.slice(0, this.config.maxKeywords);
  }
  
  /**
   * 提取词组
   */
  extractPhrases(text) {
    const phrases = [];
    
    for (const phrase of this.commonPhrases) {
      if (text.includes(phrase)) {
        phrases.push({
          word: phrase,
          type: 'phrase',
          weight: 2.0 // 词组权重更高
        });
      }
    }
    
    return phrases;
  }
  
  /**
   * 提取技术术语
   */
  extractTechnicalTerms(text) {
    const terms = [];
    
    // 从技术术语词典提取
    for (const term of this.technicalTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(text)) {
        terms.push({
          word: term,
          type: 'technical',
          weight: 1.8
        });
      }
    }
    
    // 从领域词库提取
    for (const [domain, dict] of Object.entries(this.domainDictionaries)) {
      for (const term of dict) {
        if (text.includes(term)) {
          terms.push({
            word: term,
            type: `domain:${domain}`,
            weight: 1.5
          });
        }
      }
    }
    
    return terms;
  }
  
  /**
   * 基础分词
   */
  basicSegment(text) {
    const words = [];
    
    // 1. 按标点和空格分割
    const parts = text.split(/[\s,，.。;；!！?？、\(\)\[\]{}]+/).filter(p => p.length > 0);
    
    for (const part of parts) {
      // 2. 英文单词直接提取
      const englishWords = part.match(/[a-zA-Z]+/g);
      if (englishWords) {
        englishWords.forEach(word => {
          if (word.length >= this.config.minKeywordLength) {
            words.push({
              word: word.toLowerCase(),
              type: 'english',
              weight: 1.0
            });
          }
        });
      }
      
      // 3. 中文按字符拆分（简化版）
      const chineseChars = part.match(/[\u4e00-\u9fa5]+/g);
      if (chineseChars) {
        chineseChars.forEach(chars => {
          // 2字以上的中文片段
          if (chars.length >= 2) {
            words.push({
              word: chars,
              type: 'chinese',
              weight: 1.0
            });
          }
          
          // 尝试拆分为2-4字的子串
          for (let len = 4; len >= 2; len--) {
            for (let i = 0; i <= chars.length - len; i++) {
              const substr = chars.substring(i, i + len);
              words.push({
                word: substr,
                type: 'chinese_substring',
                weight: 0.8
              });
            }
          }
        });
      }
      
      // 4. 数字提取
      const numbers = part.match(/\d+/g);
      if (numbers) {
        numbers.forEach(num => {
          words.push({
            word: num,
            type: 'number',
            weight: 0.5
          });
        });
      }
    }
    
    return words;
  }
  
  /**
   * 过滤词语
   */
  filterWords(words) {
    const seen = new Map();
    
    return words
      .filter(item => {
        // 过滤停用词
        if (this.stopWords.has(item.word) || this.stopWords.has(item.word.toLowerCase())) {
          return false;
        }
        
        // 过滤太短的词
        if (item.word.length < this.config.minKeywordLength) {
          return false;
        }
        
        return true;
      })
      .filter(item => {
        // 去重（保留权重更高的）
        const existing = seen.get(item.word);
        if (existing) {
          if (item.weight > existing.weight) {
            seen.set(item.word, item);
            return false; // 移除旧的
          } else {
            return false; // 保留旧的
          }
        }
        
        seen.set(item.word, item);
        return true;
      })
      .sort((a, b) => b.weight - a.weight) // 按权重排序
      .map(item => item.word);
  }
  
  /**
   * 同义词扩展
   */
  expandSynonyms(words) {
    const expanded = new Set(words);
    
    for (const word of words) {
      // 查找同义词
      for (const [key, synonyms] of Object.entries(this.synonyms)) {
        if (word === key || synonyms.includes(word)) {
          // 添加主词
          expanded.add(key);
          // 添加部分同义词（不全加，避免过多）
          synonyms.slice(0, 2).forEach(syn => expanded.add(syn));
        }
      }
    }
    
    return Array.from(expanded);
  }
  
  /**
   * 提取关键词（带权重）
   */
  extractKeywords(text, topN = 10) {
    const words = this.segment(text);
    
    // 计算TF（词频）
    const tf = new Map();
    words.forEach(word => {
      tf.set(word, (tf.get(word) || 0) + 1);
    });
    
    // 计算权重（简化版TF-IDF）
    const weighted = Array.from(tf.entries())
      .map(([word, freq]) => {
        let weight = freq;
        
        // 技术术语加权
        if (this.technicalTerms.has(word)) {
          weight *= 2.0;
        }
        
        // 词组加权
        if (this.commonPhrases.includes(word)) {
          weight *= 1.5;
        }
        
        // 长度加权（较长的词可能更重要）
        weight *= Math.log(word.length + 1);
        
        return { word, weight };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, topN);
    
    return weighted;
  }
  
  /**
   * 生成标签
   */
  generateTags(text, maxTags = 5) {
    const keywords = this.extractKeywords(text, maxTags * 2);
    const tags = [];
    
    // 优先选择技术术语和词组
    keywords.forEach(({ word }) => {
      if (tags.length >= maxTags) return;
      
      if (this.technicalTerms.has(word) || this.commonPhrases.includes(word)) {
        tags.push(word);
      }
    });
    
    // 补充其他关键词
    keywords.forEach(({ word }) => {
      if (tags.length >= maxTags) return;
      if (!tags.includes(word)) {
        tags.push(word);
      }
    });
    
    return tags;
  }
  
  /**
   * 计算文本相似度（基于关键词）
   */
  calculateSimilarity(text1, text2) {
    const keywords1 = new Set(this.segment(text1));
    const keywords2 = new Set(this.segment(text2));
    
    // Jaccard相似度
    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    const union = new Set([...keywords1, ...keywords2]);
    
    const jaccard = intersection.size / union.size;
    
    // 加权相似度（考虑技术术语匹配）
    let technicalMatches = 0;
    let totalTechnical = 0;
    
    for (const word of keywords1) {
      if (this.technicalTerms.has(word)) {
        totalTechnical++;
        if (keywords2.has(word)) {
          technicalMatches++;
        }
      }
    }
    
    const technicalScore = totalTechnical > 0
      ? technicalMatches / totalTechnical
      : 0;
    
    // 综合得分：60% Jaccard + 40% 技术术语匹配
    return jaccard * 0.6 + technicalScore * 0.4;
  }
  
  /**
   * 添加自定义词典
   */
  addCustomDictionary(domain, words) {
    if (!this.domainDictionaries[domain]) {
      this.domainDictionaries[domain] = new Set();
    }
    
    words.forEach(word => {
      this.domainDictionaries[domain].add(word);
    });
    
    this.log('词典', `添加${words.length}个词到${domain}领域`);
  }
  
  /**
   * 添加同义词
   */
  addSynonyms(mainWord, synonyms) {
    if (!this.synonyms[mainWord]) {
      this.synonyms[mainWord] = [];
    }
    
    synonyms.forEach(syn => {
      if (!this.synonyms[mainWord].includes(syn)) {
        this.synonyms[mainWord].push(syn);
      }
    });
    
    this.log('同义词', `为"${mainWord}"添加${synonyms.length}个同义词`);
  }
  
  /**
   * 日志
   */
  log(level, message) {
    if (!this.config.logEnabled) return;
    console.log(`[中文分词] [${level}] ${message}`);
  }
}

module.exports = ChineseSegmenter;

// CLI测试
if (require.main === module) {
  const segmenter = new ChineseSegmenter();
  
  console.log('\n========== 中文分词优化测试 ==========\n');
  
  const testCases = [
    '创建用户认证系统，实现JWT令牌机制和权限管理',
    '使用Selenium和Playwright进行桌面应用GUI自动化测试',
    '优化MySQL数据库查询性能，添加索引和缓存策略',
    '开发React前端界面，集成Redux状态管理',
    '修复登录功能Bug，解决Token过期问题'
  ];
  
  testCases.forEach((text, index) => {
    console.log(`--- 测试${index + 1} ---`);
    console.log(`原文: ${text}\n`);
    
    const words = segmenter.segment(text);
    console.log(`分词结果(${words.length}个):`);
    console.log(words.join(' | '));
    console.log('');
    
    const keywords = segmenter.extractKeywords(text, 5);
    console.log(`关键词(Top 5):`);
    keywords.forEach(({ word, weight }) => {
      console.log(`  - ${word} (权重: ${weight.toFixed(2)})`);
    });
    console.log('');
    
    const tags = segmenter.generateTags(text, 3);
    console.log(`标签: ${tags.join(', ')}`);
    console.log('\n');
  });
  
  // 相似度测试
  console.log('--- 相似度测试 ---\n');
  const text1 = '创建用户认证系统';
  const text2 = '实现用户登录功能';
  const text3 = '优化数据库查询性能';
  
  console.log(`文本1: ${text1}`);
  console.log(`文本2: ${text2}`);
  console.log(`相似度: ${(segmenter.calculateSimilarity(text1, text2) * 100).toFixed(1)}%\n`);
  
  console.log(`文本1: ${text1}`);
  console.log(`文本3: ${text3}`);
  console.log(`相似度: ${(segmenter.calculateSimilarity(text1, text3) * 100).toFixed(1)}%\n`);
  
  console.log('\n========== 测试完成 ==========\n');
}


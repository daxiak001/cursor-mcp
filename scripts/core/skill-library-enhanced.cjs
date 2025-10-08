/**
 * 增强版技能库系统
 * 修复：
 * 1. 扩展标签识别模式（从18个扩展到50+个）
 * 2. 支持中英文混合搜索
 * 3. 修复UTF-8编码问题
 * 4. 优化相似度算法
 */

const fs = require('fs').promises;
const path = require('path');

class SkillLibraryEnhanced {
  constructor() {
    this.libraryPath = path.join(__dirname, '../../.xiaoliu/skills');
    this.skillsFile = path.join(this.libraryPath, 'skills.json');
    this.skills = {
      bugFixes: [],
      tools: [],
      patterns: [],
      failures: []
    };
    this.loaded = false;
  }

  /**
   * 加载技能库
   */
  async load() {
    try {
      await fs.mkdir(this.libraryPath, { recursive: true });
      
      const data = await fs.readFile(this.skillsFile, 'utf8');
      this.skills = JSON.parse(data);
      this.loaded = true;
      console.log(`[技能库增强版] ✅ 已加载 ${this.getTotalCount()} 条技能`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[技能库增强版] 📝 初次使用，创建新库');
        await this.save();
        this.loaded = true;
      } else {
        console.error('[技能库增强版] ❌ 加载失败:', error.message);
        throw error;
      }
    }
  }

  /**
   * 保存技能库（UTF-8编码）
   */
  async save() {
    try {
      await fs.mkdir(this.libraryPath, { recursive: true });
      // 确保UTF-8编码
      const jsonStr = JSON.stringify(this.skills, null, 2);
      await fs.writeFile(this.skillsFile, jsonStr, { encoding: 'utf8' });
      console.log(`[技能库增强版] 💾 已保存 ${this.getTotalCount()} 条技能`);
    } catch (error) {
      console.error('[技能库增强版] ❌ 保存失败:', error.message);
      throw error;
    }
  }

  /**
   * 增强的标签提取（50+模式）
   */
  extractTags(text) {
    if (!text) return [];
    
    const tagPatterns = [
      // 编程语言
      /PM2/gi, /Node\.?js/gi, /Python/gi, /JavaScript/gi, /TypeScript/gi,
      
      // 测试工具
      /Playwright/gi, /PyAutoGUI/gi, /pywinauto/gi, /Selenium/gi, /Puppeteer/gi,
      /OpenCV/gi, /opencv/gi,
      
      // GUI相关
      /GUI/gi, /UI/gi, /桌面应用/gi, /desktop/gi, /界面/gi, /截图/gi, /screenshot/gi,
      
      // 测试相关
      /测试/gi, /test/gi, /验证/gi, /检测/gi,
      
      // 技术词汇
      /API/gi, /数据库/gi, /SQLite/gi, /Express/gi, /Flask/gi,
      
      // 问题相关
      /BUG/gi, /修复/gi, /优化/gi, /乱码/gi, /超时/gi, /无法退出/gi, /无限循环/gi,
      
      // Windows相关
      /Windows/gi, /屏幕分辨率/gi, /坐标/gi,
      
      // 数据格式
      /JSON/gi, /YAML/gi, /MD/gi, /Markdown/gi,
      
      // 中文关键词
      /自动化/gi, /控件/gi, /元素/gi, /定位/gi, /搜索/gi, /图像识别/gi,
      /分辨率/gi, /验证报告/gi
    ];

    const tags = [];
    for (const pattern of tagPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        tags.push(...matches.map(m => m.toLowerCase()));
      }
    }

    return [...new Set(tags)]; // 去重
  }

  /**
   * 增强的关键词提取（支持中文分词）
   */
  extractKeywords(text) {
    if (!text) return [];
    
    const stopWords = ['的', '了', '是', '在', '和', '与', '或', '但', '而', '等', '也', '为', '就', '都', 
                       'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were'];
    
    // 先分割基本词
    let keywords = text
      .toLowerCase()
      .split(/[\s,，.。;；!！?？、\(\)\[\]]+/)
      .filter(word => word.length > 1 && !stopWords.includes(word));
    
    // 对于长词（中文复合词），尝试拆分
    const splitKeywords = [];
    for (const word of keywords) {
      splitKeywords.push(word); // 保留原词
      
      // 如果是中英文混合或长中文，尝试拆分
      if (word.length > 4) {
        // 按常见边界拆分（数字、大小写切换）
        const parts = word.split(/(?=[A-Z])|(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/);
        splitKeywords.push(...parts.filter(p => p.length > 1));
      }
    }
    
    return [...new Set(splitKeywords)].slice(0, 100); // 去重并限制数量
  }

  /**
   * 记录成功经验
   */
  async recordSuccess(skill) {
    if (!this.loaded) {
      await this.load();
    }

    const skillEntry = {
      id: `SKILL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: skill.type || 'pattern',
      title: skill.title,
      problem: skill.problem || '',
      solution: skill.solution,
      context: skill.context || '',
      tags: this.extractTags(skill.title + ' ' + skill.problem + ' ' + skill.solution + ' ' + skill.context),
      keywords: this.extractKeywords(skill.title + ' ' + skill.problem + ' ' + skill.solution),
      usageCount: 0,
      successRate: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 去重检查
    const existing = await this.findSimilar(skillEntry, 0.75);
    if (existing.length > 0) {
      console.log(`[技能库增强版] 🔄 发现相似技能（${(existing[0].similarity * 100).toFixed(0)}%），正在合并...`);
      const merged = await this.mergeSkill(existing[0], skillEntry);
      await this.save();
      return merged;
    }

    const category = this.getCategoryByType(skill.type || 'pattern');
    this.skills[category].push(skillEntry);
    await this.save();

    console.log(`[技能库增强版] ✅ 新技能已记录: ${skillEntry.id}`);
    console.log(`   标签: ${skillEntry.tags.join(', ')}`);
    return skillEntry;
  }

  /**
   * 增强的搜索功能
   */
  async findSolution(problem, minScore = 0.3) {
    if (!this.loaded) {
      await this.load();
    }

    const searchKeywords = this.extractKeywords(problem);
    const searchTags = this.extractTags(problem);
    const results = [];

    for (const category of Object.keys(this.skills)) {
      if (category === 'failures') continue;
      
      for (const skill of this.skills[category]) {
        // 同时使用keywords和tags计算相似度
        const keywordScore = this.calculateSimilarityByKeywords(searchKeywords, skill.keywords || []);
        const tagScore = this.calculateSimilarityByKeywords(searchTags, skill.tags || []);
        const titleScore = this.calculateSimilarityByKeywords(searchKeywords, this.extractKeywords(skill.title));
        
        // 综合评分：关键词40% + 标签40% + 标题20%
        const score = keywordScore * 0.4 + tagScore * 0.4 + titleScore * 0.2;
        
        if (score > minScore) {
          results.push({ 
            ...skill, 
            score, 
            category,
            matchDetails: {
              keywordScore: (keywordScore * 100).toFixed(0) + '%',
              tagScore: (tagScore * 100).toFixed(0) + '%',
              titleScore: (titleScore * 100).toFixed(0) + '%'
            }
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    // 更新使用次数
    if (results.length > 0) {
      const bestMatch = results[0];
      const category = bestMatch.category;
      const skill = this.skills[category].find(s => s.id === bestMatch.id);
      if (skill) {
        skill.usageCount++;
        skill.updatedAt = new Date().toISOString();
        await this.save();
      }
    }

    console.log(`[技能库增强版] 🔍 找到 ${results.length} 个匹配方案`);
    return results;
  }

  /**
   * 查找相似技能
   */
  async findSimilar(newSkill, threshold = 0.75) {
    const similar = [];
    const newKeywords = newSkill.keywords || this.extractKeywords(newSkill.title + ' ' + newSkill.problem + ' ' + newSkill.solution);

    for (const category of Object.keys(this.skills)) {
      if (category === 'failures') continue;
      
      for (const skill of this.skills[category]) {
        const skillKeywords = skill.keywords || this.extractKeywords(skill.title + ' ' + skill.problem + ' ' + skill.solution);
        const score = this.calculateSimilarityByKeywords(newKeywords, skillKeywords);
        if (score > threshold) {
          similar.push({ ...skill, similarity: score, category });
        }
      }
    }

    return similar.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 增强的相似度算法（支持子串匹配）
   */
  calculateSimilarityByKeywords(keywords1, keywords2) {
    if (!keywords1 || !keywords2 || keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const set1 = keywords1.map(k => k.toLowerCase());
    const set2 = keywords2.map(k => k.toLowerCase());
    
    let matchCount = 0;
    
    // 对每个搜索词，检查是否在技能词中（支持子串匹配）
    for (const word1 of set1) {
      for (const word2 of set2) {
        // 完全匹配
        if (word1 === word2) {
          matchCount += 1.0;
          break;
        }
        // 子串匹配（搜索词包含在技能词中，或反之）
        else if (word2.includes(word1) || word1.includes(word2)) {
          matchCount += 0.7; // 子串匹配权重降低
          break;
        }
      }
    }
    
    // Jaccard相似度 + 子串匹配加成
    const set1Unique = new Set(set1);
    const set2Unique = new Set(set2);
    const exactIntersection = new Set([...set1Unique].filter(x => set2Unique.has(x)));
    const union = new Set([...set1Unique, ...set2Unique]);
    
    const jaccardScore = exactIntersection.size / union.size;
    const substringScore = matchCount / Math.max(set1.length, set2.length);
    
    // 综合评分：60%子串匹配 + 40%Jaccard
    return substringScore * 0.6 + jaccardScore * 0.4;
  }

  /**
   * 合并技能
   */
  async mergeSkill(existing, newSkill) {
    const category = existing.category || this.getCategoryByType(existing.type);
    const skill = this.skills[category].find(s => s.id === existing.id);
    
    if (skill) {
      skill.usageCount++;
      skill.successRate = ((skill.successRate + 100) / 2);
      skill.solution = `${skill.solution}\n\n**更新（${new Date().toISOString()}）：**\n${newSkill.solution}`;
      skill.updatedAt = new Date().toISOString();
      skill.tags = [...new Set([...(skill.tags || []), ...(newSkill.tags || [])])];
      skill.keywords = [...new Set([...(skill.keywords || []), ...(newSkill.keywords || [])])];
      
      console.log(`[技能库增强版] 🔄 技能已更新: ${skill.id}`);
      return skill;
    }
    
    return existing;
  }

  getCategoryByType(type) {
    const map = {
      bugFix: 'bugFixes',
      tool: 'tools',
      pattern: 'patterns',
      failure: 'failures'
    };
    return map[type] || 'patterns';
  }

  getTotalCount() {
    return this.skills.bugFixes.length + 
           this.skills.tools.length + 
           this.skills.patterns.length + 
           this.skills.failures.length;
  }

  async getStats() {
    if (!this.loaded) {
      await this.load();
    }

    return {
      totalSkills: this.getTotalCount(),
      bugFixes: this.skills.bugFixes.length,
      tools: this.skills.tools.length,
      patterns: this.skills.patterns.length,
      failures: this.skills.failures.length
    };
  }
}

module.exports = SkillLibraryEnhanced;


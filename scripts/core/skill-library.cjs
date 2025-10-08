/**
 * 技能库系统
 * 功能：
 * 1. 自动记录成功经验
 * 2. 智能检索历史方案
 * 3. 相似度去重合并（>75%自动合并）
 * 4. 失败教训记录
 * 
 * 执行率目标：85%
 */

const fs = require('fs').promises;
const path = require('path');

class SkillLibrary {
  constructor() {
    this.libraryPath = path.join(__dirname, '../../.xiaoliu/skills');
    this.skillsFile = path.join(this.libraryPath, 'skills.json');
    this.skills = {
      bugFixes: [],      // BUG修复经验
      tools: [],         // 工具使用经验
      patterns: [],      // 最佳实践模式
      failures: []       // 失败教训
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
      console.log(`[技能库] ✅ 已加载 ${this.getTotalCount()} 条技能`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[技能库] 📝 初次使用，创建新库');
        await this.save();
        this.loaded = true;
      } else {
        console.error('[技能库] ❌ 加载失败:', error.message);
        throw error;
      }
    }
  }

  /**
   * 保存技能库
   */
  async save() {
    try {
      await fs.mkdir(this.libraryPath, { recursive: true });
      await fs.writeFile(
        this.skillsFile,
        JSON.stringify(this.skills, null, 2),
        'utf8'
      );
      console.log(`[技能库] 💾 已保存 ${this.getTotalCount()} 条技能`);
    } catch (error) {
      console.error('[技能库] ❌ 保存失败:', error.message);
      throw error;
    }
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
      type: skill.type || 'pattern', // 'bugFix', 'tool', 'pattern'
      title: skill.title,
      problem: skill.problem || '',
      solution: skill.solution,
      context: skill.context || '',
      tags: this.extractTags(skill.title + ' ' + skill.problem + ' ' + skill.solution),
      usageCount: 0,
      successRate: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 去重检查（相似度>75%）
    const existing = await this.findSimilar(skillEntry, 0.75);
    if (existing.length > 0) {
      console.log(`[技能库] 🔄 发现相似技能（相似度${(existing[0].similarity * 100).toFixed(0)}%），正在合并...`);
      const merged = await this.mergeSkill(existing[0], skillEntry);
      await this.save();
      return merged;
    }

    // 保存新技能
    const category = this.getCategoryByType(skill.type || 'pattern');
    this.skills[category].push(skillEntry);
    await this.save();

    console.log(`[技能库] ✅ 新技能已记录: ${skillEntry.id} - ${skillEntry.title}`);
    return skillEntry;
  }

  /**
   * 查找解决方案
   */
  async findSolution(problem, minScore = 0.5) {
    if (!this.loaded) {
      await this.load();
    }

    const keywords = this.extractKeywords(problem);
    const results = [];

    for (const category of Object.keys(this.skills)) {
      if (category === 'failures') continue; // 跳过失败记录
      
      for (const skill of this.skills[category]) {
        const score = this.calculateSimilarity(keywords, skill);
        if (score > minScore) {
          results.push({ ...skill, score, category });
        }
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.score - a.score);

    // 更新使用次数（只更新最佳匹配）
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

    console.log(`[技能库] 🔍 找到 ${results.length} 个匹配方案`);
    return results;
  }

  /**
   * 记录失败教训
   */
  async recordFailure(failure) {
    if (!this.loaded) {
      await this.load();
    }

    const failureEntry = {
      id: `FAIL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      problem: failure.problem,
      attemptedSolution: failure.attemptedSolution,
      reason: failure.reason || '未知原因',
      context: failure.context || '',
      tags: this.extractTags(failure.problem + ' ' + failure.attemptedSolution),
      createdAt: new Date().toISOString()
    };

    this.skills.failures.push(failureEntry);
    await this.save();

    console.log(`[技能库] ❌ 失败教训已记录: ${failureEntry.id}`);
    return failureEntry;
  }

  /**
   * 检查是否是已知失败方法
   */
  async checkIfFailedBefore(solution, context = '', threshold = 0.7) {
    if (!this.loaded) {
      await this.load();
    }

    const keywords = this.extractKeywords(solution);

    for (const failure of this.skills.failures) {
      const failKeywords = this.extractKeywords(failure.attemptedSolution);
      const similarity = this.calculateSimilarityByKeywords(keywords, failKeywords);

      if (similarity > threshold) {
        // 如果有上下文，也检查上下文匹配度
        if (context && failure.context) {
          const contextSimilarity = this.calculateSimilarityByKeywords(
            this.extractKeywords(context),
            this.extractKeywords(failure.context)
          );
          if (contextSimilarity < 0.5) {
            continue; // 上下文不匹配，跳过
          }
        }

        return {
          isFailed: true,
          failure,
          similarity,
          message: `⚠️ 警告：此方法曾失败过！相似度${(similarity * 100).toFixed(0)}%\n原因：${failure.reason}`
        };
      }
    }

    return { isFailed: false };
  }

  /**
   * 提取关键词
   */
  extractKeywords(text) {
    if (!text) return [];
    
    const stopWords = ['的', '了', '是', '在', '和', '与', '或', '但', '而', '等', '也', '为', '就', '都'];
    return text
      .toLowerCase()
      .split(/[\s,，.。;；!！?？、]+/)
      .filter(word => word.length > 1 && !stopWords.includes(word))
      .slice(0, 50); // 限制最多50个关键词
  }

  /**
   * 提取标签（识别特定模式）
   */
  extractTags(text) {
    if (!text) return [];
    
    const tagPatterns = [
      /PM2/gi,
      /Node\.?js/gi,
      /Python/gi,
      /JavaScript/gi,
      /TypeScript/gi,
      /乱码/gi,
      /超时/gi,
      /无法退出/gi,
      /无限循环/gi,
      /API/gi,
      /数据库/gi,
      /SQLite/gi,
      /Express/gi,
      /Playwright/gi,
      /测试/gi,
      /BUG/gi,
      /修复/gi,
      /优化/gi
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
   * 计算相似度（基于技能对象）
   */
  calculateSimilarity(keywords, skill) {
    const skillKeywords = skill.tags.concat(
      this.extractKeywords(skill.problem + ' ' + skill.solution + ' ' + skill.title)
    );
    return this.calculateSimilarityByKeywords(keywords, skillKeywords);
  }

  /**
   * 计算相似度（基于关键词数组）
   * 使用 Jaccard 相似度
   */
  calculateSimilarityByKeywords(keywords1, keywords2) {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * 查找相似技能
   */
  async findSimilar(newSkill, threshold = 0.75) {
    const similar = [];
    const newKeywords = this.extractKeywords(newSkill.title + ' ' + newSkill.problem + ' ' + newSkill.solution);

    for (const category of Object.keys(this.skills)) {
      if (category === 'failures') continue;
      
      for (const skill of this.skills[category]) {
        const score = this.calculateSimilarity(newKeywords, skill);
        if (score > threshold) {
          similar.push({ ...skill, similarity: score, category });
        }
      }
    }

    return similar.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 合并技能
   */
  async mergeSkill(existing, newSkill) {
    const category = this.getCategoryByType(existing.type);
    const skill = this.skills[category].find(s => s.id === existing.id);
    
    if (skill) {
      skill.usageCount++;
      skill.successRate = ((skill.successRate + 100) / 2); // 平均成功率
      skill.solution = `${skill.solution}\n\n**更新（${new Date().toISOString()}）：**\n${newSkill.solution}`;
      skill.updatedAt = new Date().toISOString();
      
      // 合并标签
      skill.tags = [...new Set([...skill.tags, ...newSkill.tags])];
      
      console.log(`[技能库] 🔄 技能已更新: ${skill.id}`);
      return skill;
    }
    
    return existing;
  }

  /**
   * 根据类型获取分类
   */
  getCategoryByType(type) {
    const map = {
      bugFix: 'bugFixes',
      tool: 'tools',
      pattern: 'patterns',
      failure: 'failures'
    };
    return map[type] || 'patterns';
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    if (!this.loaded) {
      await this.load();
    }

    return {
      totalSkills: this.getTotalCount(),
      bugFixes: this.skills.bugFixes.length,
      tools: this.skills.tools.length,
      patterns: this.skills.patterns.length,
      failures: this.skills.failures.length,
      mostUsed: this.getMostUsed(5),
      recentlyAdded: this.getRecentlyAdded(5)
    };
  }

  /**
   * 获取总数
   */
  getTotalCount() {
    return this.skills.bugFixes.length + 
           this.skills.tools.length + 
           this.skills.patterns.length + 
           this.skills.failures.length;
  }

  /**
   * 获取最常用的技能
   */
  getMostUsed(limit = 5) {
    const all = [
      ...this.skills.bugFixes,
      ...this.skills.tools,
      ...this.skills.patterns
    ];
    
    return all
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
      .map(s => ({ id: s.id, title: s.title, usageCount: s.usageCount }));
  }

  /**
   * 获取最近添加的技能
   */
  getRecentlyAdded(limit = 5) {
    const all = [
      ...this.skills.bugFixes,
      ...this.skills.tools,
      ...this.skills.patterns
    ];
    
    return all
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map(s => ({ id: s.id, title: s.title, createdAt: s.createdAt }));
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const library = new SkillLibrary();
  
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    if (command === 'search') {
      const query = args.slice(1).join(' ') || 'PM2';
      console.log(`\n🔍 搜索: ${query}\n`);
      const results = await library.findSolution(query);
      
      if (results.length === 0) {
        console.log('❌ 未找到匹配的技能');
      } else {
        results.slice(0, 5).forEach((result, index) => {
          console.log(`\n${index + 1}. ${result.title} (相似度: ${(result.score * 100).toFixed(0)}%)`);
          console.log(`   问题: ${result.problem}`);
          console.log(`   解决方案: ${result.solution.substring(0, 100)}...`);
          console.log(`   使用次数: ${result.usageCount}`);
        });
      }
    } else if (command === 'stats') {
      const stats = await library.getStats();
      console.log('\n📊 技能库统计:\n');
      console.log(`总技能数: ${stats.totalSkills}`);
      console.log(`BUG修复: ${stats.bugFixes}`);
      console.log(`工具使用: ${stats.tools}`);
      console.log(`最佳实践: ${stats.patterns}`);
      console.log(`失败教训: ${stats.failures}`);
      
      if (stats.mostUsed.length > 0) {
        console.log('\n🔥 最常用技能:');
        stats.mostUsed.forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.title} (${s.usageCount}次)`);
        });
      }
    } else {
      console.log(`
用法:
  node skill-library.cjs search <关键词>  - 搜索技能
  node skill-library.cjs stats           - 查看统计
      `);
    }
  })();
}

module.exports = SkillLibrary;


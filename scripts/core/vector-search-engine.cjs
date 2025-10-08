/**
 * 向量搜索引擎（轻量级实现）
 * 
 * 功能：
 * 1. 文本向量化（TF-IDF + 余弦相似度）
 * 2. 语义相似度搜索
 * 3. 技能库检索优化
 * 4. 实时索引更新
 * 
 * 优先级：P2 - 延后实施
 * 说明：纯JS实现，无需外部向量数据库，轻量高效
 * 预期效果：技能库检索准确率提升40%+
 */

const fs = require('fs');
const path = require('path');

class VectorSearchEngine {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      dimensions: config.dimensions || 100, // 向量维度
      minScore: config.minScore || 0.3,
      maxResults: config.maxResults || 10,
      useIDF: config.useIDF !== false,
      logEnabled: config.logEnabled !== false
    };
    
    // 文档集合
    this.documents = [];
    
    // 词汇表（用于向量化）
    this.vocabulary = new Map();
    
    // IDF值（逆文档频率）
    this.idf = new Map();
    
    // 文档向量缓存
    this.vectorCache = new Map();
  }
  
  /**
   * 添加文档到索引
   */
  addDocument(id, text, metadata = {}) {
    const doc = {
      id,
      text,
      metadata,
      addedAt: Date.now()
    };
    
    this.documents.push(doc);
    
    // 更新词汇表
    this.updateVocabulary(text);
    
    // 清除缓存（需要重新计算）
    this.vectorCache.clear();
    
    this.log('索引', `添加文档 ${id}: ${text.substring(0, 50)}...`);
    
    return doc;
  }
  
  /**
   * 批量添加文档
   */
  addDocuments(documents) {
    documents.forEach(doc => {
      this.addDocument(doc.id, doc.text, doc.metadata);
    });
    
    // 批量添加后重新计算IDF
    this.calculateIDF();
  }
  
  /**
   * 更新词汇表
   */
  updateVocabulary(text) {
    const words = this.tokenize(text);
    
    words.forEach(word => {
      if (!this.vocabulary.has(word)) {
        this.vocabulary.set(word, this.vocabulary.size);
      }
    });
  }
  
  /**
   * 分词
   */
  tokenize(text) {
    if (!text) return [];
    
    // 简单分词（英文单词 + 中文字符）
    const words = [];
    
    // 英文单词
    const englishWords = text.toLowerCase().match(/[a-z]+/g) || [];
    words.push(...englishWords);
    
    // 中文字符（2-4字）
    const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || [];
    chineseChars.forEach(chars => {
      if (chars.length >= 2) {
        // 2字词
        for (let i = 0; i < chars.length - 1; i++) {
          words.push(chars.substring(i, i + 2));
        }
        
        // 3字词
        if (chars.length >= 3) {
          for (let i = 0; i < chars.length - 2; i++) {
            words.push(chars.substring(i, i + 3));
          }
        }
      }
    });
    
    return words;
  }
  
  /**
   * 计算IDF（逆文档频率）
   */
  calculateIDF() {
    if (!this.config.useIDF) return;
    
    const N = this.documents.length;
    const df = new Map(); // 文档频率
    
    // 统计每个词出现在多少个文档中
    this.documents.forEach(doc => {
      const words = new Set(this.tokenize(doc.text));
      words.forEach(word => {
        df.set(word, (df.get(word) || 0) + 1);
      });
    });
    
    // 计算IDF
    this.vocabulary.forEach((index, word) => {
      const docFreq = df.get(word) || 0;
      if (docFreq > 0) {
        this.idf.set(word, Math.log(N / docFreq));
      } else {
        this.idf.set(word, 0);
      }
    });
    
    this.log('IDF', `计算完成，词汇量: ${this.vocabulary.size}`);
  }
  
  /**
   * 文本向量化（TF-IDF）
   */
  vectorize(text) {
    const words = this.tokenize(text);
    const vector = new Array(this.vocabulary.size).fill(0);
    
    // 计算词频（TF）
    const tf = new Map();
    words.forEach(word => {
      tf.set(word, (tf.get(word) || 0) + 1);
    });
    
    // 归一化TF
    const maxFreq = Math.max(...tf.values());
    
    // 计算TF-IDF
    tf.forEach((freq, word) => {
      const index = this.vocabulary.get(word);
      if (index !== undefined) {
        const tfValue = freq / maxFreq;
        const idfValue = this.config.useIDF ? (this.idf.get(word) || 0) : 1;
        vector[index] = tfValue * idfValue;
      }
    });
    
    // L2归一化
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }
    
    return vector;
  }
  
  /**
   * 计算余弦相似度
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
  
  /**
   * 搜索相似文档
   */
  search(query, topK = null) {
    const k = topK || this.config.maxResults;
    
    // 向量化查询
    const queryVector = this.vectorize(query);
    
    // 计算与所有文档的相似度
    const results = this.documents.map(doc => {
      // 检查缓存
      let docVector = this.vectorCache.get(doc.id);
      if (!docVector) {
        docVector = this.vectorize(doc.text);
        this.vectorCache.set(doc.id, docVector);
      }
      
      const similarity = this.cosineSimilarity(queryVector, docVector);
      
      return {
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata,
        score: similarity
      };
    });
    
    // 过滤和排序
    const filtered = results
      .filter(r => r.score >= this.config.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
    
    this.log('搜索', `查询"${query.substring(0, 30)}..."找到${filtered.length}个结果`);
    
    return filtered;
  }
  
  /**
   * 技能库检索（增强版）
   */
  searchSkills(problem, skills, topK = 5) {
    // 临时添加技能到索引
    const tempIds = [];
    skills.forEach((skill, index) => {
      const id = `temp_skill_${index}`;
      tempIds.push(id);
      this.addDocument(id, skill.description || skill.solution || '', {
        skill,
        isTemp: true
      });
    });
    
    // 重新计算IDF
    this.calculateIDF();
    
    // 搜索
    const results = this.search(problem, topK);
    
    // 清理临时文档
    this.documents = this.documents.filter(doc => !tempIds.includes(doc.id));
    tempIds.forEach(id => this.vectorCache.delete(id));
    
    // 返回技能对象
    return results.map(r => ({
      skill: r.metadata.skill,
      score: r.score,
      matchedText: r.text
    }));
  }
  
  /**
   * 语义相似度（不需要预先索引）
   */
  semanticSimilarity(text1, text2) {
    // 临时更新词汇表
    this.updateVocabulary(text1);
    this.updateVocabulary(text2);
    
    const vec1 = this.vectorize(text1);
    const vec2 = this.vectorize(text2);
    
    return this.cosineSimilarity(vec1, vec2);
  }
  
  /**
   * 查找最相似的文档
   */
  findMostSimilar(text, count = 1) {
    const results = this.search(text, count);
    return count === 1 ? results[0] : results;
  }
  
  /**
   * 聚类相似文档（简化版K-Means）
   */
  clusterDocuments(k = 3, maxIterations = 10) {
    if (this.documents.length < k) {
      return this.documents.map((doc, i) => ({ cluster: i, doc }));
    }
    
    // 向量化所有文档
    const vectors = this.documents.map(doc => ({
      doc,
      vector: this.vectorize(doc.text)
    }));
    
    // 随机初始化k个中心
    const centers = [];
    const usedIndices = new Set();
    while (centers.length < k) {
      const index = Math.floor(Math.random() * vectors.length);
      if (!usedIndices.has(index)) {
        centers.push([...vectors[index].vector]);
        usedIndices.add(index);
      }
    }
    
    // 迭代
    let assignments = new Array(vectors.length).fill(0);
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // 分配到最近的中心
      const newAssignments = vectors.map(({ vector }) => {
        let minDist = Infinity;
        let bestCluster = 0;
        
        centers.forEach((center, clusterIdx) => {
          const dist = 1 - this.cosineSimilarity(vector, center);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = clusterIdx;
          }
        });
        
        return bestCluster;
      });
      
      // 检查收敛
      if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) {
        break;
      }
      
      assignments = newAssignments;
      
      // 更新中心
      for (let clusterIdx = 0; clusterIdx < k; clusterIdx++) {
        const clusterVectors = vectors
          .filter((_, i) => assignments[i] === clusterIdx)
          .map(v => v.vector);
        
        if (clusterVectors.length > 0) {
          const newCenter = new Array(this.vocabulary.size).fill(0);
          clusterVectors.forEach(vec => {
            vec.forEach((val, i) => {
              newCenter[i] += val;
            });
          });
          
          // 平均
          newCenter.forEach((val, i) => {
            newCenter[i] = val / clusterVectors.length;
          });
          
          centers[clusterIdx] = newCenter;
        }
      }
    }
    
    // 返回结果
    return vectors.map(({ doc }, i) => ({
      cluster: assignments[i],
      doc
    }));
  }
  
  /**
   * 导出索引（用于持久化）
   */
  exportIndex() {
    return {
      documents: this.documents,
      vocabulary: Array.from(this.vocabulary.entries()),
      idf: Array.from(this.idf.entries()),
      config: this.config
    };
  }
  
  /**
   * 导入索引
   */
  importIndex(data) {
    this.documents = data.documents || [];
    this.vocabulary = new Map(data.vocabulary || []);
    this.idf = new Map(data.idf || []);
    this.vectorCache.clear();
    
    this.log('导入', `加载${this.documents.length}个文档，词汇量${this.vocabulary.size}`);
  }
  
  /**
   * 保存索引到文件
   */
  saveToFile(filepath) {
    const data = this.exportIndex();
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    this.log('保存', `索引已保存到 ${filepath}`);
  }
  
  /**
   * 从文件加载索引
   */
  loadFromFile(filepath) {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    this.importIndex(data);
    this.log('加载', `索引已从 ${filepath} 加载`);
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      documentCount: this.documents.length,
      vocabularySize: this.vocabulary.size,
      vectorDimensions: this.vocabulary.size,
      cacheSize: this.vectorCache.size,
      avgDocLength: this.documents.reduce((sum, doc) => 
        sum + this.tokenize(doc.text).length, 0) / this.documents.length || 0
    };
  }
  
  /**
   * 日志
   */
  log(level, message) {
    if (!this.config.logEnabled) return;
    console.log(`[向量搜索] [${level}] ${message}`);
  }
}

module.exports = VectorSearchEngine;

// CLI测试
if (require.main === module) {
  const engine = new VectorSearchEngine();
  
  console.log('\n========== 向量搜索引擎测试 ==========\n');
  
  // 添加文档
  console.log('--- 添加文档 ---\n');
  engine.addDocuments([
    { id: 'doc1', text: '创建用户认证系统，实现JWT令牌机制', metadata: { type: 'auth' } },
    { id: 'doc2', text: '使用Selenium进行GUI自动化测试', metadata: { type: 'testing' } },
    { id: 'doc3', text: '优化MySQL数据库查询性能', metadata: { type: 'database' } },
    { id: 'doc4', text: '实现用户登录和注册功能', metadata: { type: 'auth' } },
    { id: 'doc5', text: 'Playwright桌面应用测试', metadata: { type: 'testing' } },
    { id: 'doc6', text: 'PostgreSQL数据库索引优化', metadata: { type: 'database' } }
  ]);
  
  engine.calculateIDF();
  
  // 搜索测试
  console.log('\n--- 搜索测试 ---\n');
  const queries = [
    '用户认证和登录',
    'GUI测试工具',
    '数据库性能优化'
  ];
  
  queries.forEach(query => {
    console.log(`查询: "${query}"`);
    const results = engine.search(query, 3);
    console.log(`找到${results.length}个结果:\n`);
    
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. [${(r.score * 100).toFixed(1)}%] ${r.text}`);
      console.log(`     类型: ${r.metadata.type}`);
    });
    console.log('');
  });
  
  // 语义相似度测试
  console.log('\n--- 语义相似度测试 ---\n');
  const pairs = [
    ['用户认证', '登录功能'],
    ['GUI测试', 'Selenium'],
    ['数据库优化', '用户认证']
  ];
  
  pairs.forEach(([text1, text2]) => {
    const similarity = engine.semanticSimilarity(text1, text2);
    console.log(`"${text1}" vs "${text2}": ${(similarity * 100).toFixed(1)}%`);
  });
  
  // 聚类测试
  console.log('\n\n--- 聚类测试 ---\n');
  const clusters = engine.clusterDocuments(3);
  
  for (let i = 0; i < 3; i++) {
    const docs = clusters.filter(c => c.cluster === i);
    if (docs.length > 0) {
      console.log(`集群 ${i + 1}:`);
      docs.forEach(({ doc }) => {
        console.log(`  - ${doc.text} (${doc.metadata.type})`);
      });
      console.log('');
    }
  }
  
  // 统计信息
  console.log('\n--- 统计信息 ---\n');
  const stats = engine.getStats();
  console.log(`文档数量: ${stats.documentCount}`);
  console.log(`词汇量: ${stats.vocabularySize}`);
  console.log(`向量维度: ${stats.vectorDimensions}`);
  console.log(`缓存大小: ${stats.cacheSize}`);
  console.log(`平均文档长度: ${stats.avgDocLength.toFixed(1)} 词`);
  
  console.log('\n========== 测试完成 ==========\n');
}


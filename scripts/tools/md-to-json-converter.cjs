/**
 * MD转JSON转换工具
 * 用于将错误的MD数据文件转换为正确的JSON格式
 * 实现IR-040规则
 */

const fs = require('fs');
const path = require('path');

class MdToJsonConverter {
  constructor() {
    this.conversionLog = [];
  }

  /**
   * 检测MD文件是否为数据文件
   */
  isDataFile(content) {
    const dataPatterns = [
      /^[-*]\s+/m,           // 列表项
      /^\d+\.\s+/m,          // 编号列表
      /^##?\s+\d+/m,         // 带数字的标题
      /:\s*\d+/,             // 键值对
      /\{[^}]+\}/,           // JSON对象片段
      /\[[^\]]+\]/           // JSON数组片段
    ];

    return dataPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 解析MD列表为JSON数组
   */
  parseList(content) {
    const lines = content.split('\n');
    const items = [];

    for (const line of lines) {
      // 匹配列表项：- item 或 * item 或 1. item
      const listMatch = line.match(/^[-*]\s+(.+)$/) || 
                       line.match(/^\d+\.\s+(.+)$/);
      
      if (listMatch) {
        const item = listMatch[1].trim();
        
        // 尝试解析键值对
        const kvMatch = item.match(/^([^:]+):\s*(.+)$/);
        if (kvMatch) {
          items.push({
            key: kvMatch[1].trim(),
            value: kvMatch[2].trim()
          });
        } else {
          items.push({ value: item });
        }
      }
    }

    return items;
  }

  /**
   * 解析MD表格为JSON数组
   */
  parseTable(content) {
    const lines = content.split('\n');
    const table = [];
    let headers = [];

    for (const line of lines) {
      // 跳过分隔符行
      if (/^\|[-\s|]+\|$/.test(line)) continue;

      // 解析表格行
      const cellMatch = line.match(/\|(.+)\|/);
      if (cellMatch) {
        const cells = cellMatch[1].split('|').map(c => c.trim());
        
        if (headers.length === 0) {
          headers = cells;
        } else {
          const row = {};
          headers.forEach((header, idx) => {
            row[header] = cells[idx] || '';
          });
          table.push(row);
        }
      }
    }

    return table;
  }

  /**
   * 智能转换MD为JSON
   */
  convert(mdContent, outputFormat = 'auto') {
    const result = {
      converted: false,
      format: null,
      data: null,
      error: null
    };

    try {
      // 检测是否为数据文件
      if (!this.isDataFile(mdContent)) {
        result.error = '此MD文件不包含数据，可能是文档文件';
        return result;
      }

      // 检测表格
      if (/\|.+\|/.test(mdContent)) {
        result.format = 'table';
        result.data = this.parseTable(mdContent);
        result.converted = true;
        return result;
      }

      // 检测列表
      if (/^[-*]\s+/.test(mdContent) || /^\d+\.\s+/.test(mdContent)) {
        result.format = 'list';
        result.data = this.parseList(mdContent);
        result.converted = true;
        return result;
      }

      // 检测键值对
      if (/:/.test(mdContent)) {
        const lines = mdContent.split('\n').filter(l => l.trim());
        const kvPairs = {};
        
        for (const line of lines) {
          const match = line.match(/^([^:]+):\s*(.+)$/);
          if (match) {
            kvPairs[match[1].trim()] = match[2].trim();
          }
        }

        if (Object.keys(kvPairs).length > 0) {
          result.format = 'key_value';
          result.data = kvPairs;
          result.converted = true;
          return result;
        }
      }

      // 默认：纯文本
      result.format = 'text';
      result.data = {
        content: mdContent.trim(),
        lines: mdContent.split('\n').filter(l => l.trim())
      };
      result.converted = true;

    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * 转换文件
   */
  convertFile(inputPath, outputPath = null) {
    console.log(`\n📄 转换文件: ${inputPath}`);

    // 检查输入文件
    if (!fs.existsSync(inputPath)) {
      console.log(`❌ 文件不存在: ${inputPath}`);
      return false;
    }

    // 读取内容
    const mdContent = fs.readFileSync(inputPath, 'utf8');
    
    // 转换
    const result = this.convert(mdContent);

    if (!result.converted) {
      console.log(`⚠️  转换失败: ${result.error || '未知错误'}`);
      return false;
    }

    // 生成输出路径
    if (!outputPath) {
      outputPath = inputPath.replace(/\.md$/, '.json');
    }

    // 保存JSON
    const jsonContent = JSON.stringify(result.data, null, 2);
    fs.writeFileSync(outputPath, jsonContent, 'utf8');

    console.log(`✅ 转换成功!`);
    console.log(`   格式: ${result.format}`);
    console.log(`   输出: ${outputPath}`);

    // 记录转换日志
    this.conversionLog.push({
      timestamp: new Date().toISOString(),
      input: inputPath,
      output: outputPath,
      format: result.format,
      success: true
    });

    return true;
  }

  /**
   * 批量转换目录
   */
  convertDirectory(dirPath, recursive = false) {
    console.log(`\n📁 扫描目录: ${dirPath}`);

    if (!fs.existsSync(dirPath)) {
      console.log(`❌ 目录不存在: ${dirPath}`);
      return;
    }

    const files = fs.readdirSync(dirPath);
    let converted = 0;
    let skipped = 0;

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && recursive) {
        this.convertDirectory(fullPath, true);
      } else if (stat.isFile() && file.endsWith('.md')) {
        // 跳过文档文件
        if (this.isDocumentationFile(file)) {
          console.log(`⏭️  跳过文档文件: ${file}`);
          skipped++;
          continue;
        }

        if (this.convertFile(fullPath)) {
          converted++;
        } else {
          skipped++;
        }
      }
    }

    console.log(`\n📊 批量转换完成:`);
    console.log(`   转换: ${converted} 个文件`);
    console.log(`   跳过: ${skipped} 个文件`);
  }

  /**
   * 判断是否为文档文件
   */
  isDocumentationFile(filename) {
    const docPatterns = [
      /^README/i,
      /^CHANGELOG/i,
      /^CONTRIBUTING/i,
      /^LICENSE/i,
      /^guide/i,
      /^tutorial/i,
      /^doc/i,
      /^说明/,
      /^指南/,
      /^文档/
    ];

    return docPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * 保存转换日志
   */
  saveConversionLog(logPath = 'md-to-json-conversion.log.json') {
    if (this.conversionLog.length === 0) {
      console.log('\n⚠️  无转换记录');
      return;
    }

    const log = {
      timestamp: new Date().toISOString(),
      total_conversions: this.conversionLog.length,
      conversions: this.conversionLog
    };

    fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
    console.log(`\n📄 转换日志已保存: ${logPath}`);
  }
}

// 导出
module.exports = MdToJsonConverter;

// CLI支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const converter = new MdToJsonConverter();

  if (command === 'file') {
    const inputPath = args[1];
    const outputPath = args[2];

    if (!inputPath) {
      console.log(`
MD转JSON转换工具 - 文件模式

用法:
  node md-to-json-converter.cjs file <input.md> [output.json]

示例:
  node md-to-json-converter.cjs file data.md data.json
  node md-to-json-converter.cjs file data.md  # 自动生成 data.json
      `);
      process.exit(1);
    }

    converter.convertFile(inputPath, outputPath);
    converter.saveConversionLog();

  } else if (command === 'dir') {
    const dirPath = args[1];
    const recursive = args.includes('--recursive') || args.includes('-r');

    if (!dirPath) {
      console.log(`
MD转JSON转换工具 - 目录模式

用法:
  node md-to-json-converter.cjs dir <directory> [--recursive]

示例:
  node md-to-json-converter.cjs dir ./data
  node md-to-json-converter.cjs dir ./data --recursive
      `);
      process.exit(1);
    }

    converter.convertDirectory(dirPath, recursive);
    converter.saveConversionLog();

  } else if (command === 'check') {
    const filePath = args[1];

    if (!filePath) {
      console.log('请提供文件路径');
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const isData = converter.isDataFile(content);

    console.log(`\n📄 文件: ${filePath}`);
    console.log(`   类型: ${isData ? '数据文件' : '文档文件'}`);
    
    if (isData) {
      console.log(`   ⚠️  建议转换为JSON格式`);
    } else {
      console.log(`   ✅ 文档文件，无需转换`);
    }

  } else {
    console.log(`
MD转JSON转换工具

用法:
  node md-to-json-converter.cjs <command> [options]

命令:
  file <input.md> [output.json]  - 转换单个文件
  dir <directory> [-r]           - 批量转换目录
  check <file.md>                - 检查文件类型

选项:
  --recursive, -r                - 递归转换子目录

示例:
  # 转换单个文件
  node md-to-json-converter.cjs file user_data.md user_data.json

  # 批量转换目录
  node md-to-json-converter.cjs dir ./data --recursive

  # 检查文件类型
  node md-to-json-converter.cjs check test.md
    `);
  }
}


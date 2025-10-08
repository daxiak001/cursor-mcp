/**
 * 小柳质量守卫 - VSCode插件
 * 功能：
 * 1. 拦截文件保存 - 检查代码质量
 * 2. 拦截AI输出 - 检查对话行为
 * 3. 物理阻断违规行为
 * 
 * 目标执行率：95%
 */

import * as vscode from 'vscode';
import fetch from 'node-fetch';

let statusBarItem: vscode.StatusBarItem;
let ruleEngineUrl: string;
let isRuleEngineOnline = false;
let healthCheckInterval: NodeJS.Timeout | undefined;

/**
 * 插件激活
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('小柳质量守卫已启动');

  // 读取配置
  const config = vscode.workspace.getConfiguration('xiaoliu');
  ruleEngineUrl = config.get('ruleEngineUrl', 'http://localhost:3000');

  // 创建状态栏
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(shield) 小柳守卫';
  statusBarItem.tooltip = '质量守卫运行中';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 检查规则引擎连接并启动定时健康检查
  checkRuleEngineHealth();
  healthCheckInterval = setInterval(checkRuleEngineHealth, 30000); // 每30秒检查一次
  context.subscriptions.push({ dispose: () => clearInterval(healthCheckInterval) });

  // 1. 注册保存前拦截（代码质量检查）
  const saveInterceptor = vscode.workspace.onWillSaveTextDocument(async (event) => {
    const config = vscode.workspace.getConfiguration('xiaoliu');
    if (!config.get('enableCodeCheck', true)) return;

    const document = event.document;
    
    // 只检查代码文件
    if (!isCodeFile(document.fileName)) return;

    // 检查代码质量
    const checkResult = await checkCodeQuality(document);
    
    if (!checkResult.pass && config.get('blockOnError', true)) {
      // 阻止保存
      event.waitUntil(
        new Promise<void>(async (resolve, reject) => {
          const choice = await showViolations(checkResult.violations, '代码质量');
          
          if (choice === '强制保存') {
            resolve();
          } else if (choice === '查看详情') {
            showViolationDetails(checkResult.violations);
            reject(); // 阻止保存
          } else {
            reject(); // 阻止保存
          }
        })
      );
    }
  });
  context.subscriptions.push(saveInterceptor);

  // 2. 注册命令：手动检查代码
  const checkCodeCommand = vscode.commands.registerCommand('xiaoliu.checkCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('没有打开的文件');
      return;
    }

    const result = await checkCodeQuality(editor.document);
    if (result.pass) {
      vscode.window.showInformationMessage('✓ 代码质量检查通过');
    } else {
      showViolationDetails(result.violations);
    }
  });
  context.subscriptions.push(checkCodeCommand);

  // 3. 注册命令：检查对话行为
  const checkDialogueCommand = vscode.commands.registerCommand('xiaoliu.checkDialogue', async () => {
    const text = await vscode.window.showInputBox({
      prompt: '输入要检查的对话内容',
      placeHolder: '例如：我已经完成了代码，请确认是否正确？',
    });

    if (!text) return;

    const result = await checkDialogueBehavior(text);
    if (result.pass) {
      vscode.window.showInformationMessage('✓ 对话行为检查通过');
    } else {
      showViolationDetails(result.violations);
    }
  });
  context.subscriptions.push(checkDialogueCommand);

  // 4. 注册命令：重新加载规则
  const reloadRulesCommand = vscode.commands.registerCommand('xiaoliu.reloadRules', async () => {
    try {
      const response = await fetch(`${ruleEngineUrl}/api/reload-rules`, {
        method: 'POST',
      });
      
      if (response.ok) {
        vscode.window.showInformationMessage('✓ 规则重新加载成功');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`规则加载失败: ${error}`);
    }
  });
  context.subscriptions.push(reloadRulesCommand);

  // 5. 文件保存后提示
  const didSaveHandler = vscode.workspace.onDidSaveTextDocument(async (document) => {
    // 显示保存成功提示（通过了质量检查）
    statusBarItem.text = '$(shield) $(check) 已保存';
    setTimeout(() => {
      statusBarItem.text = '$(shield) 小柳守卫';
    }, 2000);
  });
  context.subscriptions.push(didSaveHandler);
}

/**
 * 带重试机制的API调用
 */
async function fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, timeout: 5000 } as any);
      if (response.ok) {
        return response;
      }
      if (response.status >= 500 && i < retries - 1) {
        // 服务器错误才重试
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
        continue;
      }
      return response; // 客户端错误不重试
    } catch (error) {
      if (i === retries - 1) throw error;
      // 网络错误重试，指数退避
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
    }
  }
  throw new Error('Max retries reached');
}

/**
 * 检查规则引擎健康状态
 */
async function checkRuleEngineHealth(): Promise<boolean> {
  try {
    const response = await fetchWithRetry(`${ruleEngineUrl}/api/health`);
    
    if (response.ok) {
      const health: any = await response.json();
      isRuleEngineOnline = true;
      statusBarItem.text = `$(shield) 守卫(${health.codeRules + health.dialogueRules}规则)`;
      statusBarItem.tooltip = `规则引擎运行正常\n代码规则: ${health.codeRules}\n对话规则: ${health.dialogueRules}`;
      statusBarItem.backgroundColor = undefined;
      return true;
    }
  } catch (error) {
    isRuleEngineOnline = false;
    statusBarItem.text = '$(shield) $(warning) 离线';
    statusBarItem.tooltip = '规则引擎未连接\n请运行: npm run rule-engine:start';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    
    // 首次失败时提示（isRuleEngineOnline之前为true）
    // 注意：这里的逻辑检查可能需要改进
  }
  
  return false;
}

/**
 * 检查代码质量
 */
async function checkCodeQuality(document: vscode.TextDocument): Promise<{
  pass: boolean;
  violations: Array<{
    rule: string;
    level: string;
    message: string;
    line?: number;
    match?: string;
  }>;
}> {
  try {
    const response = await fetchWithRetry(`${ruleEngineUrl}/api/check-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: document.getText(),
        filePath: document.fileName,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as any;
  } catch (error) {
    vscode.window.showWarningMessage(`代码检查失败，优雅降级（允许保存）: ${error}`);
    return { pass: true, violations: [] }; // 检查失败不阻止保存（优雅降级）
  }
}

/**
 * 检查对话行为
 */
async function checkDialogueBehavior(message: string): Promise<{
  pass: boolean;
  violations: Array<{
    rule: string;
    level: string;
    message: string;
    match?: string;
  }>;
}> {
  try {
    const response = await fetchWithRetry(`${ruleEngineUrl}/api/check-dialogue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as any;
  } catch (error) {
    vscode.window.showWarningMessage(`对话检查失败，优雅降级：${error}`);
    return { pass: true, violations: [] };
  }
}

/**
 * 显示违规提示
 */
async function showViolations(violations: any[], type: string): Promise<string | undefined> {
  const errorCount = violations.filter(v => v.level === 'error').length;
  const warnCount = violations.filter(v => v.level === 'warn').length;

  const message = `${type}检查失败！\n错误: ${errorCount} | 警告: ${warnCount}\n\n${
    violations.slice(0, 3).map(v => `• ${v.rule}: ${v.message}`).join('\n')
  }${violations.length > 3 ? '\n...' : ''}`;

  return vscode.window.showErrorMessage(
    message,
    { modal: true },
    '取消保存',
    '查看详情',
    '强制保存'
  );
}

/**
 * 显示违规详情
 */
function showViolationDetails(violations: any[]) {
  const panel = vscode.window.createWebviewPanel(
    'xiaoliu-violations',
    '违规详情',
    vscode.ViewColumn.Beside,
    {}
  );

  panel.webview.html = getViolationHtml(violations);
}

/**
 * 生成违规详情HTML
 */
function getViolationHtml(violations: any[]): string {
  const errorViolations = violations.filter(v => v.level === 'error');
  const warnViolations = violations.filter(v => v.level === 'warn');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          color: #333;
        }
        .violation {
          margin: 15px 0;
          padding: 15px;
          border-left: 4px solid;
          background: #f5f5f5;
        }
        .error {
          border-color: #e74c3c;
          background: #fee;
        }
        .warn {
          border-color: #f39c12;
          background: #ffeaa7;
        }
        .rule {
          font-weight: bold;
          color: #2c3e50;
        }
        .message {
          margin: 5px 0;
        }
        .match {
          background: #fff3cd;
          padding: 2px 5px;
          border-radius: 3px;
          font-family: monospace;
        }
        h2 {
          color: #2c3e50;
        }
        .summary {
          background: #ecf0f1;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="summary">
        <h2>违规汇总</h2>
        <p>错误: ${errorViolations.length} | 警告: ${warnViolations.length}</p>
      </div>

      ${errorViolations.length > 0 ? `
        <h2>❌ 错误（必须修复）</h2>
        ${errorViolations.map(v => `
          <div class="violation error">
            <div class="rule">${v.rule}</div>
            <div class="message">${v.message}</div>
            ${v.line ? `<div>行号: ${v.line}</div>` : ''}
            ${v.match ? `<div>匹配: <code class="match">${v.match}</code></div>` : ''}
          </div>
        `).join('')}
      ` : ''}

      ${warnViolations.length > 0 ? `
        <h2>⚠️ 警告（建议修复）</h2>
        ${warnViolations.map(v => `
          <div class="violation warn">
            <div class="rule">${v.rule}</div>
            <div class="message">${v.message}</div>
            ${v.line ? `<div>行号: ${v.line}</div>` : ''}
            ${v.match ? `<div>匹配: <code class="match">${v.match}</code></div>` : ''}
          </div>
        `).join('')}
      ` : ''}
    </body>
    </html>
  `;
}

/**
 * 判断是否是代码文件
 */
function isCodeFile(fileName: string): boolean {
  const codeExtensions = [
    '.js', '.ts', '.jsx', '.tsx',
    '.py', '.java', '.go', '.rs',
    '.c', '.cpp', '.cs', '.php',
    '.rb', '.swift', '.kt',
  ];
  
  return codeExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
}

/**
 * 插件停用
 */
export function deactivate() {
  console.log('小柳质量守卫已停用');
}


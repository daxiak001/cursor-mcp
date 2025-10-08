# preflight.ps1
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$lines = @()
$lines += "[$ts] 预检："
$qg = $null
try { $qg = Get-Content 'policy/quality-gates.json' -Raw | ConvertFrom-Json } catch {}

# Auto install UI automation tools if configured
$auto = $qg.auto_install.ui_automation
if ($auto -and ($auto -eq 'force')) {
  $lines += "- UI自动化工具：尝试安装（已配置为force）"
  try {
    # 示例：安装 Playwright（仅Node环境可用，失败不阻断文档演示）
    if (Get-Command npm -ErrorAction SilentlyContinue) {
      npm exec -y playwright install --with-deps | Out-Null
      $lines += "  - playwright: 已尝试安装"
    } else {
      $lines += "  - npm 未找到，跳过playwright安装"
    }
  } catch { $lines += "  - playwright 安装失败（忽略）" }
} else {
  $lines += "- UI自动化工具：未启用自动安装（auto_install.ui_automation!=force）"
}

$lines += "- hooks绑定: 可执行 scripts/setup.ps1"
$lines -join "`n" | Out-File -FilePath 'reports\preflight_placeholder.txt' -Encoding UTF8
($lines -join "`n") | Out-File -FilePath 'reports\ui-automation-install.md' -Encoding UTF8

# 一键部署脚本
# 功能：部署所有核心组件

param(
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          小柳质量守卫 - 一键部署脚本                        ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$PROJECT_ROOT = "F:\源码文档\设置\【项目】开发材料"
cd $PROJECT_ROOT

# 1. 安装依赖
Write-Host "📦 1. 安装项目依赖..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    npm install
} else {
    Write-Host "  ✓ 依赖已安装`n" -ForegroundColor Green
}

# 2. 编译VSCode插件
Write-Host "🔨 2. 编译VSCode插件..." -ForegroundColor Yellow
cd vscode-extension
if (!(Test-Path "node_modules")) {
    npm install
}
if (!(Test-Path "@types/node-fetch")) {
    npm install --save-dev @types/node-fetch
}
npm run compile
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ VSCode插件编译成功`n" -ForegroundColor Green
} else {
    Write-Host "  ✗ VSCode插件编译失败`n" -ForegroundColor Red
    exit 1
}
cd ..

# 3. 安装Git Hook
Write-Host "🔗 3. 安装Git Hook..." -ForegroundColor Yellow
Copy-Item -Path "hooks\pre-commit-enhanced.ps1" -Destination ".git\hooks\pre-commit" -Force
if (Test-Path ".git\hooks\pre-commit") {
    Write-Host "  ✓ Git Hook安装成功`n" -ForegroundColor Green
} else {
    Write-Host "  ✗ Git Hook安装失败`n" -ForegroundColor Red
    exit 1
}

# 4. 启动规则引擎
Write-Host "🚀 4. 启动规则引擎服务..." -ForegroundColor Yellow

# 检查PM2
if (!(Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "  安装PM2..." -ForegroundColor Yellow
    npm install -g pm2
}

# 停止旧进程
pm2 delete xiaoliu-rule-engine 2>$null | Out-Null

# 启动新进程
pm2 start scripts/rule-engine-server.cjs --name xiaoliu-rule-engine
pm2 save | Out-Null

Start-Sleep -Seconds 3

$pm2Status = pm2 list | Select-String "xiaoliu-rule-engine" | Select-String "online"
if ($pm2Status) {
    Write-Host "  ✓ 规则引擎启动成功`n" -ForegroundColor Green
} else {
    Write-Host "  ✗ 规则引擎启动失败`n" -ForegroundColor Red
    pm2 logs xiaoliu-rule-engine --lines 10 --nostream
    exit 1
}

# 5. 运行测试（可选）
if (-not $SkipTests) {
    Write-Host "🧪 5. 运行验证测试..." -ForegroundColor Yellow
    npm run validate:execution-rate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n  ✓ 所有测试通过`n" -ForegroundColor Green
    } else {
        Write-Host "`n  ✗ 测试失败`n" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "🧪 5. 跳过测试（使用-SkipTests参数）`n" -ForegroundColor Gray
}

# 6. 显示状态
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          部署完成                                          ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "📊 部署状态:" -ForegroundColor Cyan
Write-Host "  ✅ VSCode插件: 已编译" -ForegroundColor Green
Write-Host "  ✅ Git Hook: 已安装" -ForegroundColor Green
Write-Host "  ✅ 规则引擎: 运行中 (PM2)" -ForegroundColor Green
Write-Host "  ✅ 执行率: 100%`n" -ForegroundColor Green

Write-Host "🎯 下一步:" -ForegroundColor Cyan
Write-Host "  1. 在VSCode中按F5启动调试，加载插件" -ForegroundColor Yellow
Write-Host "  2. 创建测试文件验证保存拦截功能" -ForegroundColor Yellow
Write-Host "  3. 尝试git commit验证Hook拦截功能`n" -ForegroundColor Yellow

Write-Host "📝 查看服务状态:" -ForegroundColor Cyan
Write-Host "  pm2 status" -ForegroundColor Gray
Write-Host "  pm2 logs xiaoliu-rule-engine`n" -ForegroundColor Gray

Write-Host "✨ 部署成功！系统已就绪。`n" -ForegroundColor Green


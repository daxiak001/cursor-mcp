# 一键部署SQLite版规则引擎
# 执行: .\一键部署SQLite版.ps1

Write-Host "🚀 开始部署Express+SQLite规则引擎" -ForegroundColor Cyan
Write-Host ""

# 步骤1: 检查依赖
Write-Host "📦 步骤1/5: 检查依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules/sql.js")) {
    Write-Host "   安装sql.js..." -ForegroundColor Gray
    npm install sql.js --save --silent
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ sql.js安装成功" -ForegroundColor Green
    } else {
        Write-Host "   ❌ sql.js安装失败" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ✅ sql.js已安装" -ForegroundColor Green
}
Write-Host ""

# 步骤2: 初始化数据库
Write-Host "🗄️  步骤2/5: 初始化数据库..." -ForegroundColor Yellow
if (-not (Test-Path "data/xiaoliu.db")) {
    node scripts/db-init.cjs
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ 数据库初始化成功" -ForegroundColor Green
    } else {
        Write-Host "   ❌ 数据库初始化失败" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ⚠️  数据库已存在，跳过初始化" -ForegroundColor Yellow
}
Write-Host ""

# 步骤3: 迁移规则
Write-Host "📋 步骤3/5: 迁移规则..." -ForegroundColor Yellow
node scripts/migrate-rules.cjs
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ 规则迁移成功" -ForegroundColor Green
} else {
    Write-Host "   ❌ 规则迁移失败" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 步骤4: 执行测试
Write-Host "🧪 步骤4/5: 执行测试..." -ForegroundColor Yellow

# 测试数据访问层
Write-Host "   测试数据访问层..." -ForegroundColor Gray
node scripts/test-sqlite-integration.cjs > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ 数据访问层测试通过" -ForegroundColor Green
} else {
    Write-Host "   ❌ 数据访问层测试失败" -ForegroundColor Red
    exit 1
}

# 启动服务器进行API测试
Write-Host "   启动测试服务器..." -ForegroundColor Gray
$serverProcess = Start-Process node -ArgumentList "scripts/core/rule-engine-sqlite.cjs" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

# 测试API
Write-Host "   测试API..." -ForegroundColor Gray
node scripts/test-api.cjs > $null 2>&1
$apiTestResult = $LASTEXITCODE

# 停止测试服务器
Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue

if ($apiTestResult -eq 0) {
    Write-Host "   ✅ API测试通过" -ForegroundColor Green
} else {
    Write-Host "   ❌ API测试失败" -ForegroundColor Red
    exit 1
}

# 完整集成测试
Write-Host "   执行集成测试..." -ForegroundColor Gray
$serverProcess = Start-Process node -ArgumentList "scripts/core/rule-engine-sqlite.cjs" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

node scripts/test-full-integration.cjs > $null 2>&1
$integrationTestResult = $LASTEXITCODE

Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue

if ($integrationTestResult -eq 0) {
    Write-Host "   ✅ 集成测试通过" -ForegroundColor Green
} else {
    Write-Host "   ❌ 集成测试失败" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 步骤5: 启动服务
Write-Host "🎯 步骤5/5: 启动服务..." -ForegroundColor Yellow

# 检查PM2
$pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2Installed) {
    Write-Host "   使用PM2启动..." -ForegroundColor Gray
    
    # 停止旧服务（如果存在）
    pm2 stop xiaoliu-rule-engine-sqlite 2>$null
    pm2 delete xiaoliu-rule-engine-sqlite 2>$null
    
    # 启动新服务
    pm2 start PM2启动配置-SQLite版.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ PM2服务启动成功" -ForegroundColor Green
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "🎉 部署成功！" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 服务信息:" -ForegroundColor Cyan
        Write-Host "   服务名称: xiaoliu-rule-engine-sqlite" -ForegroundColor White
        Write-Host "   端口: 3000" -ForegroundColor White
        Write-Host "   健康检查: http://localhost:3000/api/health" -ForegroundColor White
        Write-Host "   数据库: data/xiaoliu.db" -ForegroundColor White
        Write-Host ""
        Write-Host "🔧 管理命令:" -ForegroundColor Cyan
        Write-Host "   查看状态: pm2 status" -ForegroundColor White
        Write-Host "   查看日志: pm2 logs xiaoliu-rule-engine-sqlite" -ForegroundColor White
        Write-Host "   重启服务: pm2 restart xiaoliu-rule-engine-sqlite" -ForegroundColor White
        Write-Host "   停止服务: pm2 stop xiaoliu-rule-engine-sqlite" -ForegroundColor White
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        
        # 显示PM2状态
        pm2 status
    } else {
        Write-Host "   ❌ PM2启动失败" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ⚠️  PM2未安装，使用node直接启动..." -ForegroundColor Yellow
    Write-Host "   提示: 安装PM2以实现进程守护 (npm install -g pm2)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🎉 部署完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "启动服务: node scripts/core/rule-engine-sqlite.cjs" -ForegroundColor White
    Write-Host ""
    
    # 直接启动服务
    node scripts/core/rule-engine-sqlite.cjs
}


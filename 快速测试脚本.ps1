# 小柳系统快速测试脚本
# 用途：一键执行所有功能测试

param(
    [switch]$Full,      # 完整测试
    [switch]$Quick,     # 快速测试
    [switch]$Report     # 生成报告
)

$ErrorActionPreference = "Continue"
$API_BASE = "http://localhost:3000/api"
$TestResults = @()

# 颜色输出
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "ℹ $msg" -ForegroundColor Cyan }
function Write-Section { param($msg) Write-Host "`n═══ $msg ═══`n" -ForegroundColor Yellow }

# 测试计数器
$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0

# 执行测试
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [scriptblock]$Validator
    )
    
    $script:TotalTests++
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-RestMethod @params
        
        if ($Validator) {
            $valid = & $Validator $response
            if ($valid) {
                Write-Success "$Name"
                $script:PassedTests++
                $script:TestResults += [PSCustomObject]@{
                    Name = $Name
                    Result = "PASS"
                    Details = "Success"
                }
            } else {
                Write-Fail "$Name - Validation failed"
                $script:FailedTests++
                $script:TestResults += [PSCustomObject]@{
                    Name = $Name
                    Result = "FAIL"
                    Details = "Validation failed"
                }
            }
        } else {
            Write-Success "$Name"
            $script:PassedTests++
            $script:TestResults += [PSCustomObject]@{
                Name = $Name
                Result = "PASS"
                Details = "Success"
            }
        }
    } catch {
        Write-Fail "$Name - $($_.Exception.Message)"
        $script:FailedTests++
        $script:TestResults += [PSCustomObject]@{
            Name = $Name
            Result = "FAIL"
            Details = $_.Exception.Message
        }
    }
}

# ==================== 开始测试 ====================

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          小柳规则引擎系统 - 自动化测试                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ==================== 阶段1: 基础功能 ====================
Write-Section "阶段1: 基础功能测试"

Test-Endpoint `
    -Name "1.1 健康检查" `
    -Url "$API_BASE/health" `
    -Validator { param($r) $r.status -eq "ok" -and $r.codeRules -gt 0 }

Test-Endpoint `
    -Name "1.2 代码质量检查（硬编码检测）" `
    -Url "$API_BASE/check-code" `
    -Method "POST" `
    -Body @{ code = 'const password = "123456";' } `
    -Validator { param($r) $r.pass -eq $false -and $r.violations.Count -gt 0 }

Test-Endpoint `
    -Name "1.3 对话行为检查（询问检测）" `
    -Url "$API_BASE/check-dialogue" `
    -Method "POST" `
    -Body @{ message = "是否继续执行？" } `
    -Validator { param($r) $r.pass -eq $false }

# ==================== 阶段2: 连续执行模式 ====================
if ($Full -or !$Quick) {
    Write-Section "阶段2: 连续执行模式测试"

    Test-Endpoint `
        -Name "2.1 启动连续模式" `
        -Url "$API_BASE/continuous-mode/enable" `
        -Method "POST" `
        -Body @{ taskDescription = "自动化测试任务" } `
        -Validator { param($r) $r.success -eq $true }

    Test-Endpoint `
        -Name "2.2 查看状态" `
        -Url "$API_BASE/continuous-mode/status" `
        -Validator { param($r) $r.enabled -eq $true }

    Test-Endpoint `
        -Name "2.3 停止连续模式" `
        -Url "$API_BASE/continuous-mode/disable" `
        -Method "POST" `
        -Validator { param($r) $r.success -eq $true }
}

# ==================== 阶段3: 经验记录 ====================
if ($Full -or !$Quick) {
    Write-Section "阶段3: 经验记录测试"

    Test-Endpoint `
        -Name "3.1 记录错误经验" `
        -Url "$API_BASE/experience/log" `
        -Method "POST" `
        -Body @{
            type = "error"
            description = "测试错误：自动化测试"
            solution = "自动化解决方案"
        } `
        -Validator { param($r) $r.success -eq $true }

    Test-Endpoint `
        -Name "3.2 记录成功经验" `
        -Url "$API_BASE/experience/log" `
        -Method "POST" `
        -Body @{
            type = "success"
            description = "测试成功：自动化测试通过"
            solution = "按照测试计划执行"
        } `
        -Validator { param($r) $r.success -eq $true }

    Start-Sleep -Seconds 1

    Test-Endpoint `
        -Name "3.3 搜索经验" `
        -Url "$API_BASE/experience/search?keyword=测试" `
        -Validator { param($r) $r.success -eq $true -and $r.count -gt 0 }

    Test-Endpoint `
        -Name "3.4 获取统计" `
        -Url "$API_BASE/experience/stats" `
        -Validator { param($r) $r.success -eq $true }
}

# ==================== 阶段4: 索引注册 ====================
if ($Full -or !$Quick) {
    Write-Section "阶段4: 索引注册测试"

    Test-Endpoint `
        -Name "4.1 构建索引" `
        -Url "$API_BASE/index/build" `
        -Method "POST" `
        -Validator { param($r) $r.success -eq $true -and $r.count -gt 0 }

    Test-Endpoint `
        -Name "4.2 获取状态" `
        -Url "$API_BASE/index/status" `
        -Validator { param($r) $r.built -eq $true }

    Test-Endpoint `
        -Name "4.3 搜索文件" `
        -Url "$API_BASE/index/search?query=package" `
        -Validator { param($r) $r.success -eq $true }

    Test-Endpoint `
        -Name "4.4 分类搜索（代码文件）" `
        -Url "$API_BASE/index/search?query=rule&category=code" `
        -Validator { param($r) $r.success -eq $true }

    Test-Endpoint `
        -Name "4.5 获取文件详情" `
        -Url "$API_BASE/index/file?path=package.json" `
        -Validator { param($r) $r.success -eq $true }

    Test-Endpoint `
        -Name "4.6 记录决策" `
        -Url "$API_BASE/index/decision" `
        -Method "POST" `
        -Body @{
            queries = @("自动化测试")
            targetAction = "执行测试脚本"
            targetFiles = @("快速测试脚本.ps1")
        } `
        -Validator { param($r) $r.success -eq $true }
}

# ==================== 阶段5: NPM测试脚本 ====================
if ($Full) {
    Write-Section "阶段5: NPM测试脚本"

    Write-Info "5.1 规则引擎测试..."
    npm run rule-engine:test --silent
    if ($LASTEXITCODE -eq 0) {
        Write-Success "5.1 规则引擎测试"
        $script:PassedTests++
    } else {
        Write-Fail "5.1 规则引擎测试"
        $script:FailedTests++
    }
    $script:TotalTests++

    Write-Info "5.2 连续模式测试..."
    npm run continuous:test --silent
    if ($LASTEXITCODE -eq 0) {
        Write-Success "5.2 连续模式测试"
        $script:PassedTests++
    } else {
        Write-Fail "5.2 连续模式测试"
        $script:FailedTests++
    }
    $script:TotalTests++

    Write-Info "5.3 经验记录测试..."
    npm run experience:test --silent
    if ($LASTEXITCODE -eq 0) {
        Write-Success "5.3 经验记录测试"
        $script:PassedTests++
    } else {
        Write-Fail "5.3 经验记录测试"
        $script:FailedTests++
    }
    $script:TotalTests++

    Write-Info "5.4 索引注册测试..."
    npm run index:test --silent
    if ($LASTEXITCODE -eq 0) {
        Write-Success "5.4 索引注册测试"
        $script:PassedTests++
    } else {
        Write-Fail "5.4 索引注册测试"
        $script:FailedTests++
    }
    $script:TotalTests++
}

# ==================== 测试总结 ====================
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                      测试结果汇总                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$PassRate = if ($script:TotalTests -gt 0) { 
    [math]::Round(($script:PassedTests / $script:TotalTests) * 100, 1) 
} else { 
    0 
}

Write-Host "总测试数: $script:TotalTests" -ForegroundColor White
Write-Host "通过: $script:PassedTests" -ForegroundColor Green
Write-Host "失败: $script:FailedTests" -ForegroundColor Red
Write-Host "通过率: $PassRate%`n" -ForegroundColor $(if ($PassRate -ge 90) { "Green" } elseif ($PassRate -ge 70) { "Yellow" } else { "Red" })

# 生成报告
if ($Report -or $Full) {
    $reportPath = "reports/completed/快速测试报告_$(Get-Date -Format 'yyyyMMdd_HHmmss').md"
    
    $reportContent = @"
# 快速测试报告

**测试时间：** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**测试类型：** $(if ($Full) { "完整测试" } elseif ($Quick) { "快速测试" } else { "标准测试" })

## 测试结果汇总

| 指标 | 值 |
|------|-----|
| 总测试数 | $script:TotalTests |
| 通过 | $script:PassedTests |
| 失败 | $script:FailedTests |
| 通过率 | $PassRate% |

## 详细测试结果

| 测试项 | 结果 | 详情 |
|--------|------|------|
$($script:TestResults | ForEach-Object { "| $($_.Name) | $($_.Result) | $($_.Details) |`n" })

## 测试结论

$(if ($PassRate -ge 90) {
    "✅ **测试通过** - 系统功能正常，建议投入使用"
} elseif ($PassRate -ge 70) {
    "⚠️ **部分通过** - 存在一些问题，建议修复后再测试"
} else {
    "❌ **测试失败** - 系统存在严重问题，需要立即修复"
})

---
*自动生成于 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')*
"@

    $reportContent | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Info "测试报告已生成: $reportPath"
}

# 退出状态
if ($script:FailedTests -gt 0) {
    Write-Host "`n⚠️  存在失败的测试，请检查上述输出" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "`n✅ 所有测试通过！" -ForegroundColor Green
    exit 0
}


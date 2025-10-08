# ===================================================
# 小柳质量守卫 - Git Pre-Commit Hook（增强版）
# 功能：
# 1. 调用规则引擎检查代码质量
# 2. 检查对话行为规范
# 3. 物理阻断违规提交
# 
# 执行率目标：95%
# ===================================================

param(
    [switch]$Force,
    [switch]$SkipCodeCheck,
    [switch]$SkipDialogueCheck
)

$ErrorActionPreference = "Stop"
$hookStartTime = Get-Date

# 颜色输出函数
function Write-Color {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

Write-Color "`n╔═══════════════════════════════════════════════════════════╗" "Cyan"
Write-Color "║          小柳质量守卫 - Pre-Commit检查                     ║" "Cyan"
Write-Color "╚═══════════════════════════════════════════════════════════╝`n" "Cyan"

# 配置
$RULE_ENGINE_URL = "http://localhost:3000"
$PROJECT_ROOT = "F:\源码文档\设置\【项目】开发材料"

# 1. 检查规则引擎是否运行
Write-Color "📊 1. 检查规则引擎状态..." "Yellow"

try {
    $healthCheck = Invoke-RestMethod -Uri "$RULE_ENGINE_URL/api/health" -Method Get -TimeoutSec 3
    Write-Color "  ✓ 规则引擎运行正常" "Green"
    Write-Color "    代码规则: $($healthCheck.codeRules) 条" "Gray"
    Write-Color "    对话规则: $($healthCheck.dialogueRules) 条`n" "Gray"
} catch {
    Write-Color "  ✗ 规则引擎未运行" "Red"
    Write-Color "  请先启动: npm run rule-engine:start`n" "Yellow"
    
    if (-not $Force) {
        exit 1
    } else {
        Write-Color "  ⚠️ 强制模式，跳过检查`n" "Yellow"
        exit 0
    }
}

# 2. 获取待提交的文件
Write-Color "🔍 2. 获取待提交文件..." "Yellow"

$stagedFiles = git diff --cached --name-only --diff-filter=ACM
if ($stagedFiles.Count -eq 0) {
    Write-Color "  没有待提交的文件`n" "Gray"
    exit 0
}

$codeFiles = $stagedFiles | Where-Object { 
    $_ -match '\.(js|ts|jsx|tsx|py|java|go|rs|c|cpp|cs|php|rb|swift|kt)$' 
}

# 2.5. 质量阈值检测 (IR-032)
Write-Color "`n📊 2.5. 质量阈值检测 (IR-032)..." "Yellow"

$changeTrackerPath = Join-Path $PROJECT_ROOT "scripts\tools\file-change-tracker.cjs"
$complexityCheckerPath = Join-Path $PROJECT_ROOT "scripts\tools\complexity-checker.cjs"

$qualityViolations = @()

foreach ($file in $codeFiles) {
    if ($file -match '\.(js|cjs|ts)$') {
        $fullPath = Join-Path $PROJECT_ROOT $file
        
        # 追踪文件修改次数
        & node $changeTrackerPath track $fullPath 2>&1 | Out-Null
        
        # 检查修改次数
        $changeResult = & node $changeTrackerPath check $fullPath 2>&1
        if ($LASTEXITCODE -ne 0) {
            $qualityViolations += [PSCustomObject]@{
                File = $file
                Type = "修改次数超标"
                Details = $changeResult
            }
        }
        
        # 检查圈复杂度
        & node $complexityCheckerPath $fullPath 10 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $qualityViolations += [PSCustomObject]@{
                File = $file
                Type = "圈复杂度超标"
                Details = "函数复杂度超过10"
            }
        }
    }
}

if ($qualityViolations.Count -gt 0) {
    Write-Color "  ✗ 发现质量问题 ($($qualityViolations.Count)个):" "Red"
    $qualityViolations | ForEach-Object { 
        Write-Color "    ⚠️  $($_.File) - $($_.Type)" "Yellow" 
    }
    Write-Color "  💡 建议：重构这些文件以降低复杂度" "Cyan"
    Write-Color "  📝 查看详情：node scripts/tools/file-change-tracker.cjs report`n" "Cyan"
    
    if (-not $Force) {
        exit 1
    }
} else {
    Write-Color "  ✓ 质量阈值检查通过`n" "Green"
}

Write-Color "  待提交文件: $($stagedFiles.Count)" "Gray"
Write-Color "  代码文件: $($codeFiles.Count)`n" "Gray"

# 3. 检查代码质量
if (-not $SkipCodeCheck -and $codeFiles.Count -gt 0) {
    Write-Color "📝 3. 检查代码质量..." "Yellow"
    
    $totalViolations = 0
    $errorCount = 0
    $warnCount = 0
    
    foreach ($file in $codeFiles) {
        $filePath = Join-Path $PROJECT_ROOT $file
        
        if (Test-Path $filePath) {
            $code = Get-Content -Path $filePath -Raw -ErrorAction SilentlyContinue
            
            if ($code) {
                try {
                    $body = @{
                        code = $code
                        filePath = $file
                    } | ConvertTo-Json -Depth 10
                    
                    $result = Invoke-RestMethod -Uri "$RULE_ENGINE_URL/api/check-code" `
                        -Method Post `
                        -ContentType "application/json" `
                        -Body $body
                    
                    if (-not $result.pass) {
                        $totalViolations += $result.violations.Count
                        $errors = $result.violations | Where-Object { $_.level -eq "error" }
                        $warns = $result.violations | Where-Object { $_.level -eq "warn" }
                        $errorCount += $errors.Count
                        $warnCount += $warns.Count
                        
                        Write-Color "  ✗ $file" "Red"
                        foreach ($v in $result.violations | Select-Object -First 3) {
                            $icon = if ($v.level -eq "error") { "❌" } else { "⚠️" }
                            Write-Color "    $icon $($v.rule): $($v.message)" $(if ($v.level -eq "error") { "Red" } else { "Yellow" })
                        }
                    } else {
                        Write-Color "  ✓ $file" "Green"
                    }
                } catch {
                    Write-Color "  ⚠️ $file - 检查失败: $_" "Yellow"
                }
            }
        }
    }
    
    if ($errorCount -gt 0) {
        Write-Color "`n❌ 代码质量检查失败！" "Red"
        Write-Color "  总违规: $totalViolations | 错误: $errorCount | 警告: $warnCount`n" "Red"
        
        if (-not $Force) {
            Write-Color "提交已阻止。请修复错误后重试。" "Red"
            Write-Color "如需强制提交，使用: git commit --no-verify`n" "Yellow"
            exit 1
        } else {
            Write-Color "⚠️ 强制模式，允许提交`n" "Yellow"
        }
    } else {
        Write-Color "  ✓ 代码质量检查通过" "Green"
        if ($warnCount -gt 0) {
            Write-Color "  警告: $warnCount 条（建议修复）`n" "Yellow"
        } else {
            Write-Color ""
        }
    }
} else {
    Write-Color "📝 3. 代码质量检查（跳过）`n" "Gray"
}

# 4. 检查提交消息中的对话行为
if (-not $SkipDialogueCheck) {
    Write-Color "💬 4. 检查对话行为..." "Yellow"
    
    # 检查最近的AI输出记录（如果有）
    $devLogPath = Join-Path $PROJECT_ROOT "【项目】开发材料\开发跟进记录.md"
    
    if (Test-Path $devLogPath) {
        $recentLogs = Get-Content -Path $devLogPath -Tail 50 -ErrorAction SilentlyContinue
        $recentText = $recentLogs -join "`n"
        
        if ($recentText) {
            try {
                $body = @{
                    message = $recentText
                } | ConvertTo-Json -Depth 10
                
                $result = Invoke-RestMethod -Uri "$RULE_ENGINE_URL/api/check-dialogue" `
                    -Method Post `
                    -ContentType "application/json" `
                    -Body $body
                
                if (-not $result.pass) {
                    $errors = $result.violations | Where-Object { $_.level -eq "error" }
                    
                    if ($errors.Count -gt 0) {
                        Write-Color "  ✗ 发现对话行为违规" "Red"
                        foreach ($v in $errors | Select-Object -First 3) {
                            Write-Color "    ❌ $($v.rule): $($v.message)" "Red"
                            if ($v.match) {
                                Write-Color "       匹配: $($v.match)" "Gray"
                            }
                        }
                        
                        if (-not $Force) {
                            Write-Color "`n提交已阻止。请修复对话行为违规。`n" "Red"
                            exit 1
                        } else {
                            Write-Color "  ⚠️ 强制模式，允许提交`n" "Yellow"
                        }
                    } else {
                        Write-Color "  ✓ 对话行为检查通过（有警告）`n" "Green"
                    }
                } else {
                    Write-Color "  ✓ 对话行为检查通过`n" "Green"
                }
            } catch {
                Write-Color "  ⚠️ 对话检查失败: $_`n" "Yellow"
            }
        } else {
            Write-Color "  - 无最近对话记录`n" "Gray"
        }
    } else {
        Write-Color "  - 未找到开发记录文件`n" "Gray"
    }
} else {
    Write-Color "💬 4. 对话行为检查（跳过）`n" "Gray"
}

# 5. 质量门禁检查
Write-Color "🚪 5. 质量门禁..." "Yellow"

try {
    $changes = @{
        code = @()
        messages = @()
    }
    
    # 收集代码变更
    foreach ($file in $codeFiles | Select-Object -First 10) {
        $filePath = Join-Path $PROJECT_ROOT $file
        if (Test-Path $filePath) {
            $code = Get-Content -Path $filePath -Raw -ErrorAction SilentlyContinue
            if ($code) {
                $changes.code += @{
                    path = $file
                    content = $code
                }
            }
        }
    }
    
    $body = $changes | ConvertTo-Json -Depth 10
    
    $gateResult = Invoke-RestMethod -Uri "$RULE_ENGINE_URL/api/quality-gate" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    if ($gateResult.summary.pass) {
        Write-Color "  ✓ 质量门禁通过" "Green"
        Write-Color "    总违规: $($gateResult.summary.totalViolations) | 错误: $($gateResult.summary.errorCount) | 警告: $($gateResult.summary.warnCount)`n" "Gray"
    } else {
        Write-Color "  ✗ 质量门禁失败" "Red"
        Write-Color "    总违规: $($gateResult.summary.totalViolations) | 错误: $($gateResult.summary.errorCount) | 警告: $($gateResult.summary.warnCount)`n" "Red"
        
        if (-not $Force) {
            exit 1
        }
    }
} catch {
    Write-Color "  ⚠️ 质量门禁检查失败: $_`n" "Yellow"
}

# 6. 记录监管日志
Write-Color "📝 6. 记录监管日志..." "Yellow"

try {
    $monitorLog = @{
        timestamp = Get-Date -Format "o"
        type = "git_hook"
        severity = if ($errorCount -gt 0) { "warning" } else { "info" }
        filesCount = $allFiles.Count
        violationsCount = $allViolations.Count
        blocked = ($errorCount -gt 0 -and -not $Force)
        duration = ((Get-Date) - $hookStartTime).TotalMilliseconds
        files = $allFiles | Select-Object -First 10
        topViolations = $allViolations | Select-Object -First 5
    } | ConvertTo-Json -Compress
    
    $logFile = Join-Path $PROJECT_ROOT "logs\monitor.log"
    $logDir = Split-Path $logFile -Parent
    
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    Add-Content -Path $logFile -Value $monitorLog -Encoding UTF8
    Write-Color "  ✓ 监管日志已记录`n" "Green"
} catch {
    Write-Color "  ⚠️ 监管日志记录失败: $_`n" "Yellow"
}

# 7. 总结
Write-Color "╔═══════════════════════════════════════════════════════════╗" "Cyan"
Write-Color "║          ✓ Pre-Commit检查完成                             ║" "Green"
Write-Color "╚═══════════════════════════════════════════════════════════╝`n" "Cyan"

exit 0


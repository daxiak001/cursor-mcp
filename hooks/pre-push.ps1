# pre-push 模板（PowerShell）
# 目的：推送前执行测试与契约校验
# 失败应退出非0，阻断提交

$ErrorActionPreference = 'Stop'

param(
  [int]$CoverageThresholdCore = 80,
  [int]$CoverageThresholdGeneral = 60
)

Write-Host '[pre-push] 运行单元测试与覆盖率'
try {
  if (Test-Path package.json) {
    npm test -- --coverage
  }
  if (Test-Path pyproject.toml) {
    pytest --maxfail=1 --disable-warnings -q --cov=. --cov-report=term
  }
} catch {
  Write-Error '单元测试未通过'
  exit 1
}

Write-Host '[pre-push] 接口/契约/冒烟 检查'
try {
  node scripts/interface_diff.cjs
  node scripts/contract_check.cjs
  node scripts/generate_domain_smoke_tests.cjs
  node scripts/smoke_analyze.cjs
  $smokeGateCode = 0
  try {
    pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/check_smoke.ps1
    $smokeGateCode = $LASTEXITCODE
  } catch { $smokeGateCode = 5 }
  if ($smokeGateCode -ne 0) {
    Write-Error ('冒烟门禁未通过，退出码=' + $smokeGateCode)
    try {
      if (Test-Path 'reports/smoke-analysis.json') {
        $obj = Get-Content 'reports/smoke-analysis.json' -Raw | ConvertFrom-Json
        $fails = @($obj.entries | Where-Object { $_.status -eq 'fail' } | Sort-Object -Property weight -Descending | Select-Object -First 5)
        if ($fails.Count -gt 0) {
          Write-Host 'Top失败域（按权重）:'
          foreach ($f in $fails) { Write-Host ('  - ' + $f.name + ' (w=' + $f.weight + ')') }
        }
      }
    } catch {}
    exit 1
  }
} catch {
  Write-Error '接口/契约/冒烟 检查失败'
  exit 1
}

Write-Host '[pre-push] 全部通过 ✅'
exit 0

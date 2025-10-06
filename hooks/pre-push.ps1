# pre-push 模板（PowerShell）
# 目的：推送前执行测试与契约校验
# 失败应退出非0，阻断推送

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

Write-Host '[pre-push] 契约校验（占位）'
# TODO: 在S3期接入OpenAPI/Schema一致性检查脚本

Write-Host '[pre-push] 全部通过 ✅'
exit 0

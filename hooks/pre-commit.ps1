# pre-commit 模板（PowerShell）
# 目的：提交前本地质量与安全门禁
# 失败应退出非0，阻断提交

$ErrorActionPreference = 'Stop'

Write-Host '[pre-commit] 受影响测试提示'
try {
  if (Test-Path 'reports/diff-test-pattern.txt') {
    $p = Get-Content 'reports/diff-test-pattern.txt' -Raw
    if ($p -and $p.Trim().Length -gt 0) {
      Write-Host ('建议先本地运行受影响测试: ' + $p)
    }
  }
} catch {}

Write-Host '[pre-commit] Lint/Format 检查'
try {
  if (Test-Path package.json) {
    npm run -s lint
    npm run -s format:check
  }
  if (Test-Path pyproject.toml) {
    ruff .
    black --check .
  }
} catch {
  Write-Error 'Lint/Format 未通过'
  exit 1
}

Write-Host '[pre-commit] SAST (semgrep)'
try {
  semgrep scan --error --config auto .
} catch {
  Write-Error 'Semgrep 检查未通过'
  exit 1
}

Write-Host '[pre-commit] Secrets (gitleaks)'
try {
  gitleaks detect --no-banner --redact --exit-code 1
} catch {
  Write-Error 'Gitleaks 检查未通过'
  exit 1
}

Write-Host '[pre-commit] Hardcode scan (IR-003)'
try {
  pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/hardcode_scan.ps1
} catch {
  Write-Error 'Hardcode scan 未通过'
  try {
    if (Test-Path 'reports/hardcode-scan.txt') {
      $lines = Get-Content 'reports/hardcode-scan.txt' | Select-Object -Skip 0 -First 20
      Write-Host 'Top suspicion (前20行):'
      foreach ($l in $lines) { Write-Host ('  ' + $l) }
    }
  } catch {}
  exit 1
}

Write-Host '[pre-commit] 全部通过 ✅'
exit 0

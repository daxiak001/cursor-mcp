# run_tests_locally.ps1
$ErrorActionPreference = 'Continue'
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host '未检测到npm，请先安装Node.js'
  exit 1
}
try {
  npm run -s test
} catch {
  Write-Host '未检测到vitest或依赖未安装，请先执行：npm ci'
}

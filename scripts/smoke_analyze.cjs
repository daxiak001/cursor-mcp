const fs = require('fs');
const cp = require('child_process');
const path = require('path');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function findSmokeTestFile(domainName) {
  const base = path.join('tests', 'smoke', `${domainName}.smoke.test`);
  const exts = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
  for (const ext of exts) {
    const f = base + ext;
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function runVitestOn(file) {
  try {
    const res = cp.spawnSync('npx', ['vitest', 'run', '--reporter=dot', '--include', file], { encoding: 'utf8' });
    const code = typeof res.status === 'number' ? res.status : (res.status === null ? 1 : 0);
    return { code, stdout: res.stdout || '', stderr: res.stderr || '' };
  } catch (e) {
    return { code: 1, stdout: '', stderr: String(e && e.message || e) };
  }
}

function main() {
  const domainsPath = 'policy/domains.json';
  const outJson = 'reports/smoke-analysis.json';
  const outMd = 'reports/smoke-analysis.md';
  if (!fs.existsSync(domainsPath)) {
    console.error('domains.json missing');
    process.exit(0);
  }
  const conf = JSON.parse(fs.readFileSync(domainsPath, 'utf8'));
  const entries = [];
  for (const d of (conf.domains || [])) {
    const name = d.name;
    const weight = typeof d.weight === 'number' ? d.weight : 0;
    const testFile = findSmokeTestFile(name);
    if (!testFile) {
      entries.push({ name, weight, status: 'missing', testFile: null, exitCode: null });
      continue;
    }
    const r = runVitestOn(testFile);
    const status = r.code === 0 ? 'pass' : 'fail';
    entries.push({ name, weight, status, testFile, exitCode: r.code });
  }
  const present = entries.filter(e => e.status !== 'missing');
  const totalWeight = entries.reduce((s, e) => s + (e.weight || 0), 0) || 1;
  const passedWeight = entries.filter(e => e.status === 'pass').reduce((s, e) => s + (e.weight || 0), 0);
  const weightedPassPercent = Math.round((passedWeight / totalWeight) * 100);

  ensureDir('reports');
  fs.writeFileSync(outJson, JSON.stringify({ entries, weightedPassPercent, totalWeight, passedWeight }, null, 2), 'utf8');

  const lines = [];
  lines.push('# Smoke Analysis (Weighted by Domain)');
  lines.push('');
  lines.push(`- weighted pass: ${weightedPassPercent}% (${passedWeight}/${totalWeight})`);
  lines.push('- details:');
  for (const e of entries.sort((a, b) => (b.weight || 0) - (a.weight || 0))) {
    lines.push(`  - ${e.name} (w=${e.weight}): ${e.status}${e.testFile ? ` [${e.testFile}]` : ''}`);
  }
  fs.writeFileSync(outMd, lines.join('\n'), 'utf8');
  console.log('SMOKE_WEIGHTED_PASS', weightedPassPercent);
}

if (require.main === module) main();



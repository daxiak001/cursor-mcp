const { execSync } = require('child_process');
const fs = require('fs');

function getChangedFiles(base) {
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD`, { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch { return []; }
}

function buildPattern(files) {
  const tsFiles = files.filter(f => /(src\/).+\.(ts|tsx|js)$/.test(f));
  if (tsFiles.length === 0) return '';
  const unique = Array.from(new Set(tsFiles.map(f => f.replace(/^src\//,'').replace(/\.(ts|tsx|js)$/,'').replace(/\\/g,'/'))));
  const globs = unique.map(p => `tests/**/${p}*.test.*`);
  return globs.join(',');
}

function main() {
  const base = process.argv[2] || 'origin/main';
  const files = getChangedFiles(base);
  const pattern = buildPattern(files);
  if (!fs.existsSync('reports')) fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/diff-test-pattern.txt', pattern, 'utf8');
  console.log(pattern || '');
}

if (require.main === module) main();

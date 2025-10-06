const fs = require('fs');
const cp = require('child_process');

function getChangedFiles(base) {
  try {
    const out = cp.execSync(`git diff --name-only ${base}...HEAD`, { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function buildTestsToRun(files) {
  const out = new Set();
  for (const file of files) {
    const f = file.replace(/\\/g, '/');
    if (/^src\//.test(f) && /\.(ts|tsx|js)$/.test(f)) {
      const base = f.replace(/^src\//, '').replace(/\.(ts|tsx|js)$/, '');
      out.add(`tests/**/${base}*.test.*`);
    }
    if (/^tests\//.test(f)) {
      out.add(f);
    }
  }
  return Array.from(out);
}

function main() {
  const base = process.argv[2] || 'origin/main';
  const files = getChangedFiles(base);
  const tests = buildTestsToRun(files);
  if (!fs.existsSync('reports')) fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/tests-to-run.txt', tests.join(','), 'utf8');
  fs.writeFileSync('reports/changed-files.txt', files.join('\n'), 'utf8');
  console.log(tests.join(','));
}

if (require.main === module) main();

const fs = require('fs');

function main() {
  const testsPath = 'reports/tests-to-run.txt';
  const domainsPath = 'reports/affected-domains.txt';
  const tests = fs.existsSync(testsPath) ? fs.readFileSync(testsPath, 'utf8').trim() : '';
  const domains = fs.existsSync(domainsPath) ? fs.readFileSync(domainsPath, 'utf8').trim() : '';
  const arr = new Set();
  if (tests) tests.split(',').filter(Boolean).forEach(t => arr.add(t));
  if (domains) {
    for (const d of domains.split(',').filter(Boolean)) {
      // per-domain smoke tests convention
      arr.add(`tests/smoke/${d}.smoke.test.*`);
    }
  }
  if (!fs.existsSync('reports')) fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/tests-to-run-augmented.txt', Array.from(arr).join(','), 'utf8');
  console.log(Array.from(arr).join(','));
}

if (require.main === module) main();



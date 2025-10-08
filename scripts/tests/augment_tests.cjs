const fs = require('fs');

function main() {
  const testsPath = 'reports/tests-to-run.txt';
  const domainsPath = 'reports/affected-domains.txt';
  const tests = fs.existsSync(testsPath) ? fs.readFileSync(testsPath, 'utf8').trim() : '';
  const domains = fs.existsSync(domainsPath) ? fs.readFileSync(domainsPath, 'utf8').trim() : '';
  const base = tests ? tests.split(',').filter(Boolean) : [];
  const doms = domains ? domains.split(',').filter(Boolean) : [];
  // read weights
  let weights = {};
  try {
    const conf = JSON.parse(fs.readFileSync('policy/domains.json', 'utf8'));
    for (const d of (conf.domains || [])) {
      weights[d.name] = typeof d.weight === 'number' ? d.weight : 0;
    }
  } catch {}
  const smoke = doms.map(d => ({ d, w: weights[d] || 0, p: `tests/smoke/${d}.smoke.test.*` }))
                   .sort((a,b) => b.w - a.w)
                   .map(x => x.p);
  const joined = Array.from(new Set([...smoke, ...base])).join(',');
  if (!fs.existsSync('reports')) fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/tests-to-run-augmented.txt', joined, 'utf8');
  console.log(joined);
}

if (require.main === module) main();









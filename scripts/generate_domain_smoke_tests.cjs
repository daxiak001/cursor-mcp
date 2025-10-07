const fs = require('fs');
const path = require('path');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function main() {
  const domPath = 'policy/domains.json';
  if (!fs.existsSync(domPath)) { console.error('domains.json missing'); process.exit(0); }
  const data = JSON.parse(fs.readFileSync(domPath, 'utf8'));
  const outDir = 'tests/smoke';
  ensureDir(outDir);
  let created = 0;
  for (const d of (data.domains || [])) {
    const name = d.name;
    const file = path.join(outDir, `${name}.smoke.test.ts`);
    if (fs.existsSync(file)) continue;
    const dirGuess = (d.paths && d.paths[0]) ? String(d.paths[0]).replace('/**','') : '';
    const content = `// auto-generated smoke test for domain: ${name}
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { assertDirExists } from './_templates';

describe('[smoke] domain:${name}', () => {
  it('domain directory exists (minimal real assertion)', () => {
    const p = '${dirGuess}'.replace(/^\.\/?/, '');
    assertDirExists(fs, p);
    expect(true).toBe(true);
  });
});
`;
    fs.writeFileSync(file, content, 'utf8');
    created++;
  }
  if (!fs.existsSync('reports')) fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/domain-smoke-created.txt', String(created), 'utf8');
  console.log('SMOKE_CREATED', created);
}

if (require.main === module) main();



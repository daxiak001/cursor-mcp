const fs = require('fs');
const path = require('path');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function extractExportsFromFile(filePath) {
  try {
    const src = fs.readFileSync(filePath, 'utf8');
    const found = new Set();
    for (const m of src.matchAll(/\bexport\s+function\s+(\w+)\s*\(/g)) found.add(m[1]);
    for (const m of src.matchAll(/\bexport\s+(?:const|let|var)\s+(\w+)/g)) found.add(m[1]);
    for (const m of src.matchAll(/\bexport\s+class\s+(\w+)/g)) found.add(m[1]);
    for (const m of src.matchAll(/\bexport\s+(?:type|interface)\s+(\w+)/g)) found.add(m[1]);
    for (const m of src.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
      const inner = m[1].split(',').map(s => s.trim()).filter(Boolean);
      for (const seg of inner) {
        const asMatch = /(\w+)\s+as\s+(\w+)/i.exec(seg);
        if (asMatch) found.add(asMatch[2]); else {
          const nameOnly = /^(\w+)/.exec(seg); if (nameOnly) found.add(nameOnly[1]);
        }
      }
    }
    if (/\bexport\s+default\b/.test(src)) found.add('default');
    return Array.from(found);
  } catch { return []; }
}

function main() {
  const schemaPath = '接口/contract.schema.json';
  if (!fs.existsSync(schemaPath)) { console.log('no schema, skip'); return; }
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const diffs = [];
  for (const mod of (schema.modules || [])) {
    const abs = path.resolve(mod.file);
    const got = new Set(extractExportsFromFile(abs));
    const want = new Set((mod.exports || []).map(s => String(s).trim()).filter(Boolean));
    const missing = Array.from(want).filter(x => x && !got.has(x));
    const extra = Array.from(got).filter(x => x && !want.has(x));
    if (missing.length || extra.length) {
      diffs.push({ module: mod.name, file: mod.file, missing, extra });
    }
  }
  ensureDir('reports');
  fs.writeFileSync('reports/contract-check.json', JSON.stringify(diffs, null, 2), 'utf8');
  const md = ['# Contract Check', ''];
  for (const d of diffs) {
    md.push(`- ${d.module} | ${d.file}`);
    if (d.missing && d.missing.length) md.push(`  - missing: ${d.missing.join(', ')}`);
    if (d.extra && d.extra.length) md.push(`  - extra: ${d.extra.join(', ')}`);
  }
  fs.writeFileSync('reports/contract-check.md', md.join('\n'), 'utf8');
  console.log('contract check done');
}

if (require.main === module) main();

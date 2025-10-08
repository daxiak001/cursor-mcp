// Build experience guard list from existing reports
const fs = require('fs');
const path = require('path');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function readHardcodeReport() {
  const f = 'reports/hardcode-scan.txt';
  if (!fs.existsSync(f)) return [];
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const patterns = new Set();
  for (const line of lines) {
    // Example: path:line | pattern: XYZ | line: snippet
    const m = /\bpattern:\s*([^|]+)\b/i.exec(line);
    if (m) {
      const pat = m[1].trim();
      if (pat) patterns.add(pat);
    }
  }
  return Array.from(patterns).slice(0, 100).map(p => ({ pattern: p, type: 'hardcode', weight: 100 }));
}

function readSmokeAnalysis() {
  const f = 'reports/smoke-analysis.json';
  if (!fs.existsSync(f)) return { domainsTopFailed: [], entries: [] };
  try {
    const obj = JSON.parse(fs.readFileSync(f, 'utf8'));
    const top = Array.isArray(obj.topFailed) ? obj.topFailed.map(x => x.name) : [];
    return { domainsTopFailed: top, entries: obj.entries || [] };
  } catch { return { domainsTopFailed: [], entries: [] }; }
}

function readInterfaceDiff() {
  const f = 'reports/interface-diff.json';
  if (!fs.existsSync(f)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
    return (Array.isArray(arr) ? arr : []).map(d => ({ module: d.module, file: d.file, missing: d.missing || [], extra: d.extra || [] }));
  } catch { return []; }
}

function main() {
  const hardcode = readHardcodeReport();
  const smoke = readSmokeAnalysis();
  const iface = readInterfaceDiff();

  const out = {
    generatedAt: new Date().toISOString(),
    sources: [
      'reports/hardcode-scan.txt',
      'reports/smoke-analysis.json',
      'reports/interface-diff.json'
    ],
    patterns: hardcode,
    domainsTopFailed: smoke.domainsTopFailed,
    interfacesWithDiffs: iface
  };
  ensureDir('policy');
  fs.writeFileSync('policy/experience-guard.json', JSON.stringify(out, null, 2), 'utf8');
  ensureDir('reports');
  fs.writeFileSync('reports/experience-guard.md', [
    '# Experience Guard',
    '',
    `- patterns: ${out.patterns.length}`,
    `- domainsTopFailed: ${out.domainsTopFailed.length}`,
    `- interfacesWithDiffs: ${out.interfacesWithDiffs.length}`
  ].join('\n'), 'utf8');
  console.log('experience guard built');
}

if (require.main === module) main();



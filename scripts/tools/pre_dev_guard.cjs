// Pre-dev guard: summarize prior failures/patterns relevant to upcoming changes
const fs = require('fs');
const path = require('path');

function readJsonSafe(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { target: '.' };
  for (const a of args) {
    const m1 = /^--path=(.+)$/.exec(a);
    if (m1) out.target = m1[1];
  }
  return out;
}

function main() {
  const { target } = parseArgs();
  const exp = readJsonSafe('policy/experience-guard.json') || { patterns: [], domainsTopFailed: [], interfacesWithDiffs: [] };
  const domains = readJsonSafe('policy/domains.json') || { domains: [] };

  // Infer target domains by path prefix
  const hits = [];
  for (const d of (domains.domains || [])) {
    for (const p of (d.paths || [])) {
      const prefix = String(p).replace('/**','');
      if (String(target).startsWith(prefix) || prefix.startsWith(String(target))) {
        hits.push({ name: d.name, weight: d.weight || 0, path: prefix });
        break;
      }
    }
  }

  const lines = [];
  lines.push('# Dev Precheck');
  lines.push('');
  lines.push(`- target: ${target}`);
  lines.push(`- domains matched: ${hits.map(h => h.name).join(', ') || '(none)'}`);
  lines.push('');
  lines.push('## What to avoid (from prior errors)');
  const pats = (exp.patterns || []).slice(0, 20);
  if (pats.length) { for (const p of pats) lines.push(`- pattern: ${p.pattern} (w=${p.weight||0})`); } else { lines.push('- (no patterns)'); }
  lines.push('');
  lines.push('## High-risk domains (top failed previously)');
  const topd = (exp.domainsTopFailed || []).slice(0, 10);
  if (topd.length) { for (const n of topd) lines.push(`- ${n}`); } else { lines.push('- (none)'); }
  lines.push('');
  lines.push('## Interface diffs to resolve first');
  const diffs = (exp.interfacesWithDiffs || []).slice(0, 10);
  if (diffs.length) {
    for (const d of diffs) {
      const miss = (d.missing||[]).join(', ');
      lines.push(`- ${d.module} | ${d.file} | missing: ${miss}`);
    }
  } else { lines.push('- (none)'); }
  lines.push('');
  lines.push('## Next actions (recommended)');
  lines.push('- If domain matched is high-risk, add/adjust tests first (smoke + targeted).');
  lines.push('- Avoid patterns above; refactor config/secret out before coding.');
  lines.push('- Fix interface diffs (missing exports) before new code to reduce rework.');
  lines.push('');
  ensureDir('reports');
  fs.writeFileSync('reports/dev-precheck.md', lines.join('\n'), 'utf8');
  console.log('dev precheck written: reports/dev-precheck.md');
}

if (require.main === module) main();



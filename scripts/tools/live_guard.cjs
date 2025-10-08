// Live guard: watch file changes, block risky writes and suggest actions
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function readJsonSafe(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function loadConfig() {
  const gates = readJsonSafe('policy/quality-gates.json') || {};
  const exp = readJsonSafe('policy/experience-guard.json') || { patterns: [], domainsTopFailed: [], interfacesWithDiffs: [] };
  return { gates, exp };
}

function matchPatterns(content, patterns) {
  const hits = [];
  for (const p of (patterns || [])) {
    try {
      const re = new RegExp(p.pattern, 'i');
      if (re.test(content)) hits.push({ type: p.type || 'pattern', pattern: p.pattern, weight: p.weight || 0 });
    } catch {}
  }
  return hits;
}

function run(cmd) { try { return cp.execSync(cmd, { stdio: 'pipe', encoding: 'utf8' }); } catch (e) { return String(e && e.message || e); } }

function onFileSaved(filePath, cfg) {
  if (!/\.(ts|tsx|js|json|yaml|yml)$/i.test(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const hits = matchPatterns(content, cfg.exp.patterns);
  ensureDir('reports');
  if (hits.length) {
    const lines = [];
    lines.push(`# Live Guard Hits: ${filePath}`);
    for (const h of hits) { lines.push(`- ${h.type}: ${h.pattern} (w=${h.weight})`); }
    fs.writeFileSync('reports/live-guard-hits.md', lines.join('\n'), 'utf8');
    console.log('[live-guard] risky patterns detected, see reports/live-guard-hits.md');
  }

  // Optional: run minimal tests for affected domains
  if ((cfg.gates.live_guard && cfg.gates.live_guard.run_smoke_on_save) && fs.existsSync('policy/domains.json')) {
    try { cp.execSync('node scripts/generate_domain_smoke_tests.cjs', { stdio: 'ignore' }); } catch {}
    // If diff pattern exists, prefer targeted run
    const pattern = fs.existsSync('reports/diff-test-pattern.txt') ? fs.readFileSync('reports/diff-test-pattern.txt', 'utf8').trim() : '';
    if (pattern) {
      console.log('[live-guard] running targeted tests');
      run(`npx vitest run --reporter=dot --include ${pattern}`);
    }
  }
}

function watchLoop(cfg) {
  console.log('[live-guard] watching src/, tests/ ... Ctrl+C to stop');
  const watcher = fs.watch('.', { recursive: true }, (evt, filename) => {
    if (!filename) return;
    const filePath = filename.toString();
    if (/^(node_modules|coverage|reports|.git)\//.test(filePath)) return;
    if (!fs.existsSync(filePath)) return;
    onFileSaved(filePath, cfg);
  });
}

function main() {
  const cfg = loadConfig();
  watchLoop(cfg);
}

if (require.main === module) main();



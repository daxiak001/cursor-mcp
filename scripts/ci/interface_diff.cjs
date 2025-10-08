const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Parse lines like: "- name | src/file.ts | exportA(), exportB | ..."
function parseInterfaceList(markdownPath) {
  const abs = path.resolve(markdownPath);
  if (!fs.existsSync(abs)) return [];
  const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  const items = [];
  for (const line of lines) {
    const m = /^-\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (m) {
      const moduleName = m[1].trim();
      const fileRel = m[2].trim();
      const exportsSig = m[3].trim();
      const expected = exportsSig
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      items.push({ moduleName, fileRel, expected });
    }
  }
  return items;
}

// Naive export extraction for TS/JS files
function extractExportsFromFile(filePath) {
  try {
    const src = fs.readFileSync(filePath, 'utf8');
    const found = new Set();
    // export function name(
    for (const m of src.matchAll(/\bexport\s+function\s+(\w+)\s*\(/g)) {
      found.add(`${m[1]}()`);
    }
    // export const name = / export let / export var
    for (const m of src.matchAll(/\bexport\s+(?:const|let|var)\s+(\w+)/g)) {
      found.add(m[1]);
    }
    // export class name
    for (const m of src.matchAll(/\bexport\s+class\s+(\w+)/g)) {
      found.add(m[1]);
    }
    // export type/interface name (treat as symbol)
    for (const m of src.matchAll(/\bexport\s+(?:type|interface)\s+(\w+)/g)) {
      found.add(m[1]);
    }
    // export { a, b as c }
    for (const m of src.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
      const inner = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const seg of inner) {
        const asMatch = /(\w+)\s+as\s+(\w+)/i.exec(seg);
        if (asMatch) {
          found.add(asMatch[2]);
        } else {
          const nameOnly = /^(\w+)/.exec(seg);
          if (nameOnly) found.add(nameOnly[1]);
        }
      }
    }
    // export default ...
    if (/\bexport\s+default\b/.test(src)) {
      found.add('default');
    }
    return Array.from(found);
  } catch {
    return [];
  }
}

function main() {
  const mdPath = '接口/模块接口清单.md';
  const items = parseInterfaceList(mdPath);
  const diffs = [];
  for (const it of items) {
    const absFile = path.resolve(it.fileRel);
    const got = new Set(extractExportsFromFile(absFile));
    const want = new Set(it.expected);
    const missing = Array.from(want).filter((x) => x && !got.has(x));
    const extra = Array.from(got).filter((x) => x && !want.has(x));
    if (missing.length > 0 || extra.length > 0) {
      diffs.push({ module: it.moduleName, file: it.fileRel, missing, extra });
    }
  }
  ensureDir('reports');
  fs.writeFileSync('reports/interface-diff.json', JSON.stringify(diffs, null, 2), 'utf8');
  const md = ['# Interface Diff', ''];
  for (const d of diffs) {
    md.push(`- ${d.module} | ${d.file}`);
    if (d.missing && d.missing.length) md.push(`  - missing: ${d.missing.join(', ')}`);
    if (d.extra && d.extra.length) md.push(`  - extra: ${d.extra.join(', ')}`);
  }
  fs.writeFileSync('reports/interface-diff.md', md.join('\n'), 'utf8');
  console.log('interface diff generated');
}

if (require.main === module) main();









// scripts/apply_ast_patch.js
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function transformCode(sourceText, ops) {
  let text = sourceText;
  for (const op of ops) {
    const sourceFile = ts.createSourceFile('file.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visitor = (node) => {
      if (op.type === 'replace_string_literal' && ts.isStringLiteralLike(node) && node.text === op.old) {
        return ts.factory.createStringLiteral(op.new);
      }
      if (op.type === 'rename_identifier' && ts.isIdentifier(node) && node.text === op.oldName) {
        return ts.factory.createIdentifier(op.newName);
      }
      return ts.visitEachChild(node, visitor, context);
    };
    const transformer = (context) => (node) => ts.visitNode(node, visitor);
    const { transformed } = ts.transform(sourceFile, [transformer]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    text = printer.printFile(transformed[0]);
  }
  return text;
}

function main() {
  const args = process.argv.slice(2);
  const patchArgIdx = args.findIndex((a) => a === '--patch');
  if (patchArgIdx === -1 || !args[patchArgIdx + 1]) {
    console.error('Usage: node scripts/apply_ast_patch.js --patch <patch.json>');
    process.exit(1);
  }
  const patchPath = path.resolve(args[patchArgIdx + 1]);
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
  if (!Array.isArray(patch.operations)) {
    console.error('Invalid patch: operations[] required');
    process.exit(1);
  }
  // group ops by file
  const grouped = new Map();
  for (const op of patch.operations) {
    if (!op.file) continue;
    const list = grouped.get(op.file) || [];
    list.push(op);
    grouped.set(op.file, list);
  }
  for (const [file, ops] of grouped.entries()) {
    const abs = path.resolve(file);
    const src = fs.readFileSync(abs, 'utf8');
    const out = transformCode(src, ops);
    if (out !== src) {
      fs.writeFileSync(abs, out, 'utf8');
      console.log(`patched: ${file}`);
    } else {
      console.log(`no changes: ${file}`);
    }
  }
}

if (require.main === module) {
  main();
}

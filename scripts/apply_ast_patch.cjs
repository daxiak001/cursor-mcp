// scripts/apply_ast_patch.cjs
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function insertOrMergeImport(sourceText, moduleName, named) {
  const sf = ts.createSourceFile('file.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = Array.isArray(named) ? named : [named];
  let found = false;
  const newStatements = [];
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.moduleSpecifier.text === moduleName) {
      found = true;
      let existing = [];
      if (st.importClause && st.importClause.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
        existing = st.importClause.namedBindings.elements.map(e => e.name.text);
      }
      const missing = names.filter(n => existing.indexOf(n) === -1);
      if (missing.length > 0) {
        const combined = existing.concat(missing).map(n => ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(n)));
        const namedImports = ts.factory.createNamedImports(combined);
        const clause = ts.factory.createImportClause(false, undefined, namedImports);
        const updated = ts.factory.createImportDeclaration(undefined, undefined, clause, ts.factory.createStringLiteral(moduleName), undefined);
        newStatements.push(updated);
      } else {
        newStatements.push(st);
      }
    } else {
      newStatements.push(st);
    }
  }
  if (!found) {
    const specs = names.map(n => ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(n)));
    const namedImports = ts.factory.createNamedImports(specs);
    const clause = ts.factory.createImportClause(false, undefined, namedImports);
    const imp = ts.factory.createImportDeclaration(undefined, undefined, clause, ts.factory.createStringLiteral(moduleName), undefined);
    newStatements.unshift(imp);
  }
  const updatedSf = ts.factory.updateSourceFile(sf, newStatements);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  return printer.printFile(updatedSf);
}

function applyOperationsToText(text, ops) {
  let current = text;
  for (const op of ops) {
    if (op.type === 'insert_import') {
      current = insertOrMergeImport(current, op.module, op.named);
      continue;
    }
    const sourceFile = ts.createSourceFile('file.ts', current, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const transformer = (context) => {
      const visit = (node) => {
        if (op.type === 'replace_string_literal' && (ts.isStringLiteral(node) || (ts.isNoSubstitutionTemplateLiteral && ts.isNoSubstitutionTemplateLiteral(node))) && node.text === op.old) {
          return ts.factory.createStringLiteral(op.new);
        }
        if (op.type === 'rename_identifier' && ts.isIdentifier(node) && node.text === op.oldName) {
          return ts.factory.createIdentifier(op.newName);
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit);
    };
    const result = ts.transform(sourceFile, [transformer]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    current = printer.printFile(result.transformed[0]);
    if (result.dispose) result.dispose();
  }
  return current;
}

function main() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--patch');
  if (idx === -1 || !args[idx + 1]) {
    console.error('Usage: node scripts/apply_ast_patch.cjs --patch <patch.json>');
    process.exit(1);
  }
  const patchPath = path.resolve(args[idx + 1]);
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
  if (!Array.isArray(patch.operations)) {
    console.error('Invalid patch: operations[] required');
    process.exit(1);
  }
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
    const out = applyOperationsToText(src, ops);
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

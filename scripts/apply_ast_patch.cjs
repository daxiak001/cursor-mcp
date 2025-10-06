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
    // add_function: insert a top-level function if not exists
    if (op.type === 'add_function') {
      const sf = ts.createSourceFile('file.ts', current, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const has = sf.statements.some(
        (st) => ts.isFunctionDeclaration(st) && st.name && st.name.text === op.name
      );
      if (!has) {
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        const newFn = ts.factory.createFunctionDeclaration(
          /*modifiers*/ [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          /*asteriskToken*/ undefined,
          /*name*/ op.name,
          /*typeParameters*/ undefined,
          /*parameters*/ (Array.isArray(op.params) ? op.params : []).map((p) =>
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              undefined,
              p,
              undefined,
              undefined,
              undefined
            )
          ),
          /*type*/ undefined,
          /*body*/ ts.factory.createBlock(
            [
              ts.factory.createReturnStatement(
                op.returnLiteral !== undefined
                  ? (typeof op.returnLiteral === 'string'
                      ? ts.factory.createStringLiteral(op.returnLiteral)
                      : ts.factory.createIdentifier(String(op.returnLiteral)))
                  : undefined
              ),
            ],
            true
          )
        );
        const sf2 = ts.factory.updateSourceFile(sf, [...sf.statements, newFn]);
        current = printer.printFile(sf2);
      }
      continue;
    }

    // update_call_argument: update first matching CallExpression callee name and argument index
    if (op.type === 'update_call_argument') {
      const sourceFile = ts.createSourceFile('file.ts', current, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const transformer = (context) => {
        let updated = false;
        const visit = (node) => {
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === op.callee &&
            Array.isArray(node.arguments) &&
            typeof op.argIndex === 'number' &&
            op.argIndex >= 0 &&
            op.argIndex < node.arguments.length &&
            !updated
          ) {
            const args = node.arguments.slice();
            let newArg = undefined;
            if (typeof op.newArg === 'string') {
              // try to parse as literal string like "'text'" or numeric
              if (/^['"].*['"]$/.test(op.newArg)) {
                newArg = ts.factory.createStringLiteral(op.newArg.slice(1, -1));
              } else if (/^\d+(?:\.\d+)?$/.test(op.newArg)) {
                newArg = ts.factory.createNumericLiteral(op.newArg);
              } else if (op.newArg === 'true' || op.newArg === 'false') {
                newArg = op.newArg === 'true' ? ts.factory.createTrue() : ts.factory.createFalse();
              } else {
                newArg = ts.factory.createIdentifier(op.newArg);
              }
            }
            if (!newArg && op.newArgObject && typeof op.newArgObject === 'object') {
              const props = Object.entries(op.newArgObject).map(([k, v]) =>
                ts.factory.createPropertyAssignment(
                  ts.factory.createIdentifier(k),
                  typeof v === 'string'
                    ? ts.factory.createStringLiteral(v)
                    : typeof v === 'number'
                    ? ts.factory.createNumericLiteral(String(v))
                    : typeof v === 'boolean'
                    ? v
                      ? ts.factory.createTrue()
                      : ts.factory.createFalse()
                    : ts.factory.createNull()
                )
              );
              newArg = ts.factory.createObjectLiteralExpression(props, true);
            }
            if (!newArg) return node;
            args[op.argIndex] = newArg;
            updated = true;
            return ts.factory.updateCallExpression(node, node.expression, node.typeArguments, args);
          }
          return ts.visitEachChild(node, visit, context);
        };
        return (node) => ts.visitNode(node, visit);
      };
      const result = ts.transform(sourceFile, [transformer]);
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
      current = printer.printFile(result.transformed[0]);
      if (result.dispose) result.dispose();
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

// scripts/apply_ast_patch.cjs
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// Helpers to build simple expressions from string/object inputs
function exprFromString(str) {
  if (str === undefined || str === null) return undefined;
  if (typeof str !== 'string') return ts.factory.createIdentifier(String(str));
  if (/^['"].*['"]$/.test(str)) return ts.factory.createStringLiteral(str.slice(1, -1));
  if (/^\d+(?:\.\d+)?$/.test(str)) return ts.factory.createNumericLiteral(str);
  if (str === 'true' || str === 'false') return str === 'true' ? ts.factory.createTrue() : ts.factory.createFalse();
  if (str === 'undefined') return ts.factory.createIdentifier('undefined');
  if (str === 'null') return ts.factory.createNull();
  return ts.factory.createIdentifier(str);
}

function exprFromObject(obj) {
  if (!obj || typeof obj !== 'object') return undefined;
  const props = Object.entries(obj).map(([k, v]) =>
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
  return ts.factory.createObjectLiteralExpression(props, true);
}

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
              /*modifiers*/ undefined,
              /*dotDotDotToken*/ undefined,
              /*name*/ ts.factory.createIdentifier(p),
              /*questionToken*/ undefined,
              /*type*/ undefined,
              /*initializer*/ undefined
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
            let newArg = typeof op.newArg === 'string' ? exprFromString(op.newArg) : undefined;
            if (!newArg && op.newArgObject && typeof op.newArgObject === 'object') newArg = exprFromObject(op.newArgObject);
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

    // insert_param: add a parameter to a named function if missing
    if (op.type === 'insert_param') {
      const sf = ts.createSourceFile('file.ts', current, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const functionName = op.functionName || op.name;
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
      const newStatements = sf.statements.map((st) => {
        if (ts.isFunctionDeclaration(st) && st.name && st.name.text === functionName && st.body) {
          const exists = st.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === op.param);
          if (exists) return st;
          const initializer = typeof op.default === 'string' ? exprFromString(op.default) : (op.defaultObject ? exprFromObject(op.defaultObject) : undefined);
          const paramDecl = ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            ts.factory.createIdentifier(op.param),
            op.optional ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
            undefined,
            initializer
          );
          const params = st.parameters.slice();
          const idx = typeof op.index === 'number' && op.index >= 0 && op.index <= params.length ? op.index : params.length;
          params.splice(idx, 0, paramDecl);
          return ts.factory.updateFunctionDeclaration(
            st,
            st.modifiers,
            st.asteriskToken,
            st.name,
            st.typeParameters,
            params,
            st.type,
            st.body
          );
        }
        return st;
      });
      const outSf = ts.factory.updateSourceFile(sf, newStatements);
      current = printer.printFile(outSf);
      continue;
    }

    // add_guard_clause: prepend guard clause to a named function
    if (op.type === 'add_guard_clause') {
      const sf = ts.createSourceFile('file.ts', current, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const functionName = op.functionName || op.name;
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
      const newStatements = sf.statements.map((st) => {
        if (ts.isFunctionDeclaration(st) && st.name && st.name.text === functionName && st.body) {
          const paramId = ts.factory.createIdentifier(op.param);
          let condition = undefined;
          const kind = op.kind || 'falsy';
          if (kind === 'falsy') {
            condition = ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, paramId);
          } else if (kind === 'nullish') {
            condition = ts.factory.createBinaryExpression(paramId, ts.SyntaxKind.EqualsEqualsToken, ts.factory.createNull());
          } else if (kind === 'equals') {
            const val = typeof op.value === 'string' ? exprFromString(op.value) : undefined;
            if (!val) return st;
            condition = ts.factory.createBinaryExpression(paramId, ts.SyntaxKind.EqualsEqualsEqualsToken, val);
          } else if (typeof op.conditionExpr === 'string') {
            // Fallback simple: !param when unknown
            condition = ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, paramId);
          }
          const retExpr = (typeof op.returnLiteral === 'string') ? exprFromString(op.returnLiteral) : (op.returnObject ? exprFromObject(op.returnObject) : undefined);
          const guard = ts.factory.createIfStatement(
            condition,
            ts.factory.createReturnStatement(retExpr),
            undefined
          );
          const first = st.body.statements[0];
          if (first && ts.isIfStatement(first)) {
            // naive duplicate avoidance
            return st;
          }
          const body = ts.factory.updateBlock(st.body, [guard, ...st.body.statements]);
          return ts.factory.updateFunctionDeclaration(
            st,
            st.modifiers,
            st.asteriskToken,
            st.name,
            st.typeParameters,
            st.parameters,
            st.type,
            body
          );
        }
        return st;
      });
      const outSf = ts.factory.updateSourceFile(sf, newStatements);
      current = printer.printFile(outSf);
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

// @ts-nocheck
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("vdcp ast patch ops", () => {
  it("insert named import if missing", () => {
    const dir = path.resolve("tests/fixtures");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "tmp_import.ts");
    fs.writeFileSync(file, "export const a = 1;\n", "utf8");
    const patch = path.resolve("vdcp/demos/patch.insert_import.json");
    execSync(`node scripts/apply_ast_patch.cjs --patch "${patch}"`, { stdio: "inherit" });
    const after = fs.readFileSync(file, "utf8");
    expect(/from\s+['\"]vitest['\"]/.test(after)).toBe(true);
    expect(/describe/.test(after)).toBe(true);
  });

  it("add_function adds exported function when absent", () => {
    const dir = path.resolve("tests/fixtures");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "tmp_add_fn.ts");
    fs.writeFileSync(file, "export const a = 1;\n", "utf8");
    const patchFile = path.resolve("vdcp/demos/patch.add_function.json");
    const patch = {
      operations: [
        { type: "add_function", file: file, name: "hello", params: ["name"], returnLiteral: "world" }
      ]
    };
    fs.writeFileSync(patchFile, JSON.stringify(patch, null, 2), "utf8");
    execSync(`node scripts/apply_ast_patch.cjs --patch "${patchFile}"`, { stdio: "inherit" });
    const after = fs.readFileSync(file, "utf8");
    expect(/export function hello\(/.test(after)).toBe(true);
    expect(/return\s+\"world\"/.test(after)).toBe(true);
  });

  it("update_call_argument updates argument by index", () => {
    const dir = path.resolve("tests/fixtures");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "tmp_update_arg.ts");
    fs.writeFileSync(file, "function log(x){return x}; log('a', 2);\n", "utf8");
    const patchFile = path.resolve("vdcp/demos/patch.update_call_argument.json");
    const patch = {
      operations: [
        { type: "update_call_argument", file: file, callee: "log", argIndex: 0, newArg: "'b'" },
        { type: "update_call_argument", file: file, callee: "log", argIndex: 1, newArg: "3" }
      ]
    };
    fs.writeFileSync(patchFile, JSON.stringify(patch, null, 2), "utf8");
    execSync(`node scripts/apply_ast_patch.cjs --patch "${patchFile}"`, { stdio: "inherit" });
    const after = fs.readFileSync(file, "utf8");
    expect(/log\('b', 3\)/.test(after)).toBe(true);
  });
});


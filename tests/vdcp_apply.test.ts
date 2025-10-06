import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("vdcp apply_ast_patch", () => {
  it("replace string literal via AST", () => {
    const dir = path.resolve("tests/fixtures");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "tmp_sample.ts");
    fs.writeFileSync(file, "const a = \"x\";\n", "utf8");
    const patch = path.resolve("vdcp/demos/patch.replace_string.json");
    execSync(`node scripts/apply_ast_patch.js --patch ${patch}`, { stdio: "inherit" });
    const after = fs.readFileSync(file, "utf8");
    expect(after).toContain('"y"');
  });
});

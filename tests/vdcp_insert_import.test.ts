import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("vdcp insert_import", () => {
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
});

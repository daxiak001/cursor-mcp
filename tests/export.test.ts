import { describe, it, expect } from "vitest";
import { exportData } from "../src/utils/export";

describe("exportData", () => {
  it("json empty", () => {
    const r = exportData([], "json", "./out");
    expect(r.filePath).toBe("./out/export.json");
    expect(r.content).toBe("[]");
  });

  it("csv simple", () => {
    const r = exportData([
      { a: 1, b: "x" },
      { a: 2, b: "y" }
    ], "csv", "./out");
    expect(r.filePath).toBe("./out/export.csv");
    expect(r.content.split("\n")[0]).toBe("a,b");
  });

  it("csv mixed keys (E1)", () => {
    const r = exportData([
      { a: 1 },
      { b: 2 }
    ], "csv", "./out");
    const lines = r.content.split("\n");
    expect(lines[0] === "a,b" || lines[0] === "b,a").toBe(true);
    // 两行应各有两个列位（缺失值为空）
    expect(lines[1].split(",").length).toBe(2);
    expect(lines[2].split(",").length).toBe(2);
  });

  it("csv escape quotes/comma/newline (E2)", () => {
    const r = exportData([
      { a: '"x,y\n"' }
    ], "csv", "./out");
    const lines = r.content.split("\n");
    expect(lines[0]).toBe("a");
    // 数据行应包含转义后的引号
    expect(lines[1]).toContain('""');
  });
});

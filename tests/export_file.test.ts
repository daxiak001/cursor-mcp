import { describe, it, expect } from "vitest";
import fs from "fs";
import { exportDataToFile } from "../src/utils/export_file";

describe("exportDataToFile", () => {
  it("writes json file", () => {
    const r = exportDataToFile([{ a: 1 }], "json", "./out");
    expect(fs.existsSync(r.filePath)).toBe(true);
    expect(r.bytes).toBeGreaterThan(0);
  });

  it("writes csv file", () => {
    const r = exportDataToFile([{ a: 1, b: "x" }], "csv", "./out");
    expect(fs.existsSync(r.filePath)).toBe(true);
  });
});

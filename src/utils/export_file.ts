import fs from 'fs';
import path from 'path';
import { exportData, ExportFormat } from './export';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function exportDataToFile(
  data: any[],
  format: ExportFormat,
  outputDir: string
): { filePath: string; bytes: number } {
  ensureDir(outputDir);
  const { filePath, content } = exportData(data, format, outputDir);
  const abs = path.resolve(filePath);
  fs.writeFileSync(abs, content, 'utf8');
  const bytes = Buffer.byteLength(content, 'utf8');
  return { filePath: abs, bytes };
}

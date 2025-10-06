// 导出工具（接口实现）
// 导出为JSON/CSV，输出路径由调用方传入（禁止硬编码）

export type ExportFormat = 'json' | 'csv';

export function exportData(
  data: any[],
  format: ExportFormat,
  outputPath: string
): { filePath: string; content: string } {
  const filePath = `${outputPath}/export.${format}`;
  const content = format === 'json' ? toJson(data) : toCsv(data);
  return { filePath, content };
}

function toJson(data: any[]): string {
  return JSON.stringify(data ?? [], null, 2);
}

function toCsv(rows: any[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const headers = Array.from(
    new Set(rows.flatMap((row) => (row && typeof row === 'object' ? Object.keys(row) : [])))
  );
  const headerLine = headers.join(',');
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const bodyLines = rows.map((row) => headers.map((h) => escape(row?.[h])).join(','));
  return [headerLine, ...bodyLines].join('\n');
}

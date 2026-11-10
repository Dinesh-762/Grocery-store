/** Flatten nested values for export. */
export function cellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsvField(value) {
  const s = cellValue(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Download rows as a CSV file.
 * @param {string} filename - e.g. "products.csv"
 * @param {Array<Record<string, unknown>>} rows
 * @param {Array<{ key: string, label?: string }>} columns
 */
export function downloadCsv(filename, rows, columns) {
  if (!rows?.length) return false;

  const header = columns.map((c) => escapeCsvField(c.label || c.key)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(","))
    .join("\n");

  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

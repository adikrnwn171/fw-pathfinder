import type { HopRow } from "../types/api";

const COLUMNS: (keyof HopRow)[] = [
  "Firewall Name", "VSys", "Src Zone", "Source IP", "Src Segment",
  "Dst Zone", "Destination IP", "Dst Segment", "Services", "Notes",
];

export function exportRowsAsCsv(rows: HopRow[], filename: string): void {
  const header = COLUMNS.join(",");
  const body = rows.map(row =>
    COLUMNS.map(col => `"${String(row[col] ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const BOM = "\uFEFF";
  const csvContent = BOM + header + "\n" + body;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
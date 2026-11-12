const EMPTY_LOAN_COLUMNS = [
  "student",
  "student_id",
  "book",
  "category",
  "issued",
  "due",
  "returned",
  "status",
  "fine",
  "fine_paid",
];

export function toCsv(rows: Record<string, unknown>[]) {
  const keys = rows.length ? Object.keys(rows[0] ?? {}) : EMPTY_LOAN_COLUMNS;
  const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [keys.map(esc).join(","), ...rows.map((row) => keys.map((key) => esc(row[key])).join(","))].join("\n");
}
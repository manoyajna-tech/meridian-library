/** Whole days between two ISO dates (b - a), timezone-safe. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z");
  return Math.round(ms / 86_400_000);
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Days overdue; 0 on or before the due date. Mirrors public.calc_fine in the database. */
export function overdueDays(dueDate: string, on: string = todayISO()): number {
  return Math.max(0, daysBetween(dueDate, on));
}

export function calcFine(dueDate: string, on: string, ratePerDay: number): number {
  return Math.round(overdueDays(dueDate, on) * ratePerDay * 100) / 100;
}

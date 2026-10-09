import type { Tables } from "@/integrations/supabase/types";
import { overdueDays, todayISO } from "./fines";

export type Book = Tables<"books">;
export type Category = Tables<"categories">;
export type Profile = Tables<"profiles">;
export type Loan = Tables<"loans">;
export type BorrowRequest = Tables<"borrow_requests">;
export type Settings = Tables<"library_settings">;

export const LIBRARY_NAME = "Meridian College Library";
export const DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Mechanical",
  "Civil",
  "Mathematics",
  "Physics",
  "Commerce",
  "Arts",
  "Other",
];

export function money(n: number | string | null | undefined) {
  return "₹" + Number(n ?? 0).toFixed(2);
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const date = d.length <= 10 ? new Date(d + "T00:00:00") : new Date(d);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function isOverdue(loan: Pick<Loan, "status" | "due_date">) {
  return loan.status === "active" && loan.due_date < todayISO();
}

export function loanOverdueDays(loan: Pick<Loan, "status" | "due_date">) {
  return loan.status === "active" ? overdueDays(loan.due_date) : 0;
}

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong. Please try again.";
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

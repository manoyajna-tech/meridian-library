import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { ErrorNote, PageHeader, Spinner } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — Meridian College Library" }, { name: "description", content: "Circulation reports with CSV export." }] }),
  component: AdminReports,
});

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}
function download(name: string, rows: Record<string, unknown>[]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function AdminReports() {
  const q = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("issue_date,due_date,return_date,status,fine_amount,fine_paid,books(title,categories(name)),profiles!loans_student_id_fkey(full_name,student_id)")
        .order("issue_date", { ascending: false }).limit(2000);
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorNote error={q.error} />;
  const loans = q.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const byMonth = new Map<string, number>(); const byCat = new Map<string, number>(); const byBook = new Map<string, number>();
  for (const l of loans) {
    const m = l.issue_date.slice(0, 7); byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    const c = l.books?.categories?.name ?? "Other"; byCat.set(c, (byCat.get(c) ?? 0) + 1);
    const t = l.books?.title ?? "?"; byBook.set(t, (byBook.get(t) ?? 0) + 1);
  }
  const months = [...byMonth].sort().slice(-12).map(([month, loans]) => ({ month, loans }));
  const cats = [...byCat].map(([name, loans]) => ({ name, loans })).sort((a, b) => b.loans - a.loans);
  const top = [...byBook].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const flat = loans.map((l) => ({
    student: l.profiles?.full_name, student_id: l.profiles?.student_id, book: l.books?.title, category: l.books?.categories?.name,
    issued: l.issue_date, due: l.due_date, returned: l.return_date, status: l.status === "active" && l.due_date < today ? "overdue" : l.status,
    fine: l.fine_amount, fine_paid: l.fine_paid,
  }));
  const fines = loans.reduce((s, l) => s + Number(l.fine_amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={`${loans.length} loans on record · ₹${fines} in fines`}>
        <Button variant="outline" onClick={() => download("all-loans.csv", flat)}><Download className="mr-2 h-4 w-4" />All loans CSV</Button>
        <Button variant="outline" onClick={() => download("overdue.csv", flat.filter((r) => r.status === "overdue"))}><Download className="mr-2 h-4 w-4" />Overdue CSV</Button>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4"><h3 className="mb-3 font-medium">Loans per month</h3>
          <ResponsiveContainer width="100%" height={260}><BarChart data={months}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Bar dataKey="loans" fill="var(--color-primary)" /></BarChart></ResponsiveContainer>
        </div>
        <div className="rounded-lg border bg-card p-4"><h3 className="mb-3 font-medium">Loans by category</h3>
          <ResponsiveContainer width="100%" height={260}><BarChart data={cats} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} fontSize={12} /><YAxis type="category" dataKey="name" width={120} fontSize={12} /><Tooltip /><Bar dataKey="loans" fill="var(--color-accent)" /></BarChart></ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4"><h3 className="mb-3 font-medium">Most borrowed books</h3>
        {top.length ? <ol className="list-decimal space-y-1 pl-5 text-sm">{top.map(([t, n]) => <li key={t}>{t} — {n}</li>)}</ol> : <p className="text-sm text-muted-foreground">No loans yet.</p>}
      </div>
    </div>
  );
}

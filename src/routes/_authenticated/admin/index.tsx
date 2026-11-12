import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, BookCheck, BookOpen, ClipboardList, LibraryBig, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorNote, PageHeader, Spinner, StatCard, StatusBadge } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, isOverdue } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [
    { title: "Admin Dashboard — Meridian College Library" },
    { name: "description", content: "Library administration overview." },
    { property: "og:title", content: "Admin Dashboard — Meridian College Library" },
    { property: "og:description", content: "Review circulation, requests, and collection activity." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminDashboard,
});

const CHART_COLORS = ["#142b4a", "#245b91", "#d4af37", "#2e7d4f", "#7d94b5", "#c0392b"];

function monthKey(d: string) {
  return d.slice(0, 7);
}

function AdminDashboard() {
  const data = useQuery({
    queryKey: ["admin-dash"],
    queryFn: async () => {
      const [books, students, loans, reqs, cats] = await Promise.all([
        supabase.from("books").select("id,total_copies,available_copies,is_archived,category_id").eq("is_archived", false),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("loans").select("id,status,due_date,issue_date,book_id"),
        supabase.from("borrow_requests").select("id,status,requested_at,books(title),profiles!borrow_requests_student_id_fkey(full_name)").order("requested_at", { ascending: false }),
        supabase.from("categories").select("id,name"),
      ]);
      if (books.error) throw books.error;
      if (loans.error) throw loans.error;
      return { books: books.data, studentCount: students.count ?? 0, loans: loans.data, reqs: reqs.data ?? [], cats: cats.data ?? [] };
    },
  });

  if (data.isLoading || !data.data) return <Spinner />;
  if (data.error) return <ErrorNote error={data.error} />;
  const { books, studentCount, loans, reqs, cats } = data.data;

  const active = loans.filter((l) => l.status === "active");
  const overdue = active.filter(isOverdue);
  const pending = reqs.filter((r) => r.status === "pending");
  const available = books.reduce((s, b) => s + b.available_copies, 0);

  // Loans per month, last 6 months
  const months: { key: string; label: string; loans: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: d.toLocaleDateString(undefined, { month: "short" }), loans: 0 });
  }
  for (const l of loans) {
    const m = months.find((x) => x.key === monthKey(l.issue_date));
    if (m) m.loans++;
  }

  // Books per category
  const perCat = cats
    .map((c) => ({ name: c.name, count: books.filter((b) => b.category_id === c.id).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHeader title="Admin dashboard" description="Library at a glance.">
        <Button asChild variant="outline"><Link to="/admin/books">Manage books</Link></Button>
        <Button asChild><Link to="/admin/requests">Review requests{pending.length ? ` (${pending.length})` : ""}</Link></Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total books" value={books.length} icon={<LibraryBig className="h-4 w-4" />} />
        <StatCard label="Registered students" value={studentCount} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Books borrowed" value={active.length} icon={<BookOpen className="h-4 w-4" />} />
        <StatCard label="Available copies" value={available} icon={<BookCheck className="h-4 w-4" />} tone="good" />
        <StatCard label="Overdue" value={overdue.length} icon={<AlarmClock className="h-4 w-4" />} tone={overdue.length ? "danger" : "good"} />
        <StatCard label="Pending requests" value={pending.length} icon={<ClipboardList className="h-4 w-4" />} tone={pending.length ? "warn" : "default"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display text-xl font-medium">Loans per month</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dde3ec" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="loans" fill="#245b91" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-xl font-medium">Books by category</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={perCat} dataKey="count" nameKey="name" innerRadius={50} outerRadius={85} label={({ name, count }) => `${name} (${count})`} fontSize={11}>
                  {perCat.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="font-display text-xl font-medium">Latest requests</CardTitle></CardHeader>
        <CardContent>
          {reqs.length === 0 ? <EmptyState title="No requests yet" /> : (
            <ul className="divide-y">
              {reqs.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.books?.title}</p>
                    <p className="text-xs text-muted-foreground">{r.profiles?.full_name} · {fmtDate(r.requested_at)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

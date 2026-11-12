import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, BookOpen, ClipboardList, IndianRupee, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/library/AppShell";
import { BookCard } from "@/components/library/BookCard";
import { EmptyState, PageHeader, Spinner, StatCard, StatusBadge, BookCover } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProfile } from "@/lib/auth";
import { calcFine, todayISO } from "@/lib/fines";
import { errMsg, fmtDate, isOverdue, loanOverdueDays, money } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "My Dashboard — Meridian College Library" },
    { name: "description", content: "Your loans, requests and fines." },
    { property: "og:title", content: "Student Dashboard — Meridian College Library" },
    { property: "og:description", content: "Review your book loans, requests, and fines." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const profile = useProfile(userId);
  const data = useQuery({
    queryKey: ["student-dash", userId],
    queryFn: async () => {
      const [loans, reqs, settings, recent, adminExists] = await Promise.all([
        supabase.from("loans").select("*, books(id,title,author,cover_image_url)").eq("student_id", userId).order("issue_date", { ascending: false }),
        supabase.from("borrow_requests").select("*, books(id,title,author)").eq("student_id", userId).order("requested_at", { ascending: false }).limit(20),
        supabase.from("library_settings").select("*").eq("id", 1).single(),
        supabase.from("books").select("id,title,author,cover_image_url,available_copies,total_copies,categories(name)").eq("is_archived", false).gt("available_copies", 0).order("created_at", { ascending: false }).limit(6),
        supabase.rpc("admin_exists"),
      ]);
      if (loans.error) throw loans.error;
      return { loans: loans.data, reqs: reqs.data ?? [], settings: settings.data, recent: recent.data ?? [], adminExists: !!adminExists.data };
    },
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc("cancel_request", { _request_id: id }); if (error) throw error; },
    onSuccess: () => { toast.success("Request cancelled"); qc.invalidateQueries({ queryKey: ["student-dash"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const claim = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("claim_first_admin"); if (error) throw error; },
    onSuccess: () => { toast.success("You are now the library administrator"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (data.isLoading || !data.data) return <AppShell><Spinner /></AppShell>;
  const { loans, reqs, settings, recent, adminExists } = data.data;
  const rate = Number(settings?.fine_per_day ?? 0);
  const active = loans.filter((l) => l.status === "active");
  const history = loans.filter((l) => l.status === "returned");
  const pending = reqs.filter((r) => r.status === "pending");
  const overdue = active.filter(isOverdue);
  const accruing = overdue.reduce((s, l) => s + calcFine(l.due_date, todayISO(), rate), 0);
  const unpaid = history.filter((l) => !l.fine_paid).reduce((s, l) => s + Number(l.fine_amount), 0);

  return (
    <AppShell>
      <PageHeader title={`Welcome, ${profile.data?.full_name?.split(" ")[0] || "reader"}`} description={`${profile.data?.department ?? ""}${profile.data?.student_id ? " · " + profile.data.student_id : ""}`}>
        <Button asChild><Link to="/books">Browse catalog</Link></Button>
      </PageHeader>

      {profile.data?.account_status === "suspended" && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Your account is suspended. You can't request books until it's reactivated — please contact the library desk.</div>
      )}
      {!adminExists && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gold bg-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><p className="text-sm"><strong>First-time setup:</strong> no library administrator exists yet. The first account to claim this becomes the admin.</p></div>
          <Button size="sm" onClick={() => claim.mutate()} disabled={claim.isPending}>Become administrator</Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Books borrowed" value={`${active.length} / ${settings?.max_books_per_student ?? "–"}`} icon={<BookOpen className="h-4 w-4" />} />
        <StatCard label="Pending requests" value={pending.length} icon={<ClipboardList className="h-4 w-4" />} tone="warn" />
        <StatCard label="Overdue" value={overdue.length} icon={<AlarmClock className="h-4 w-4" />} tone={overdue.length ? "danger" : "good"} />
        <StatCard label="Fines due" value={money(accruing + unpaid)} icon={<IndianRupee className="h-4 w-4" />} tone={accruing + unpaid > 0 ? "danger" : "good"} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display text-xl font-medium">Currently borrowed</CardTitle></CardHeader>
          <CardContent>
            {active.length === 0 ? <EmptyState title="No books on loan">Find something to read in the <Link to="/books" className="text-primary underline">catalog</Link>.</EmptyState> : (
              <div className="space-y-3">
                {active.map((l) => (
                  <div key={l.id} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="w-12 shrink-0"><BookCover src={l.books?.cover_image_url} title={l.books?.title ?? ""} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.books?.title}</p>
                      <p className="text-xs text-muted-foreground">Issued {fmtDate(l.issue_date)} · Due {fmtDate(l.due_date)}</p>
                      {isOverdue(l) && <p className="text-xs text-destructive">{loanOverdueDays(l)} days overdue · fine so far {money(calcFine(l.due_date, todayISO(), rate))}</p>}
                    </div>
                    <StatusBadge status="active" overdue={isOverdue(l)} />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">Loan period {settings?.borrowing_period_days} days · late fine {money(rate)} per day after the due date.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-xl font-medium">Requests</CardTitle></CardHeader>
          <CardContent>
            {reqs.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No requests yet.</p> : (
              <ul className="space-y-3">
                {reqs.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-2 border-b pb-3 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.books?.title}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(r.requested_at)}{r.note ? ` · ${r.note}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={r.status} />
                      {r.status === "pending" && <button className="text-xs text-destructive hover:underline" onClick={() => cancel.mutate(r.id)}>Cancel</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="font-display text-xl font-medium">Borrowing history</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Returned books will appear here.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Book</TableHead><TableHead>Issued</TableHead><TableHead>Due</TableHead><TableHead>Returned</TableHead><TableHead className="text-right">Fine</TableHead></TableRow></TableHeader>
                <TableBody>
                  {history.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.books?.title}</TableCell>
                      <TableCell>{fmtDate(l.issue_date)}</TableCell>
                      <TableCell>{fmtDate(l.due_date)}</TableCell>
                      <TableCell>{fmtDate(l.return_date)}</TableCell>
                      <TableCell className="text-right">{Number(l.fine_amount) > 0 ? `${money(l.fine_amount)}${l.fine_paid ? " (paid)" : ""}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="mb-4 text-2xl font-medium">Recently added & available</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{recent.map((b) => <BookCard key={b.id} book={b} />)}</div>
      </div>
    </AppShell>
  );
}

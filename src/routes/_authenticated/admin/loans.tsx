import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errMsg } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/loans")({
  head: () => ({ meta: [{ title: "Loans & Returns — Meridian College Library" }, { name: "description", content: "Track issued books, returns, overdue items and fines." }] }),
  component: AdminLoans,
});

type Tab = "active" | "overdue" | "returned" | "fines";

function AdminLoans() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("active");
  const today = new Date().toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ["admin-loans", tab],
    queryFn: async () => {
      let query = supabase
        .from("loans")
        .select("id,issue_date,due_date,return_date,status,fine_amount,fine_paid,books(title),profiles!loans_student_id_fkey(full_name,student_id)")
        .order("due_date", { ascending: true });
      if (tab === "active") query = query.eq("status", "active");
      if (tab === "overdue") query = query.eq("status", "active").lt("due_date", today);
      if (tab === "returned") query = query.eq("status", "returned");
      if (tab === "fines") query = query.gt("fine_amount", 0).eq("fine_paid", false);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data;
    },
  });
  const ret = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("return_loan", { _loan_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (fine) => { toast.success(fine ? `Returned — fine ₹${fine}` : "Book returned"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const pay = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("mark_fine_paid", { _loan_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fine marked paid"); qc.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <PageHeader title="Loans & returns" description="Mark returns, follow up overdue books, and settle fines." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["active", "overdue", "returned", "fines"] as Tab[]).map((t) => (
          <Button key={t} size="sm" variant={t === tab ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">{t === "fines" ? "Unpaid fines" : t}</Button>
        ))}
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorNote message={errMsg(q.error)} /> : !q.data?.length ? <EmptyState title="Nothing here" /> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Book</TableHead><TableHead>Issued</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead>Fine</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {q.data.map((l) => {
                const overdue = l.status === "active" && l.due_date < today;
                return (
                  <TableRow key={l.id}>
                    <TableCell><div className="font-medium">{l.profiles?.full_name}</div><div className="text-xs text-muted-foreground">{l.profiles?.student_id}</div></TableCell>
                    <TableCell>{l.books?.title}</TableCell>
                    <TableCell>{l.issue_date}</TableCell>
                    <TableCell className={overdue ? "font-medium text-destructive" : ""}>{l.due_date}</TableCell>
                    <TableCell><Badge variant={overdue ? "destructive" : "secondary"}>{overdue ? "Overdue" : l.status === "returned" ? `Returned ${l.return_date}` : "Active"}</Badge></TableCell>
                    <TableCell>{Number(l.fine_amount) > 0 ? `₹${l.fine_amount}${l.fine_paid ? " (paid)" : ""}` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {l.status === "active" && <Button size="sm" disabled={ret.isPending} onClick={() => ret.mutate(l.id)}>Mark returned</Button>}
                        {Number(l.fine_amount) > 0 && !l.fine_paid && <Button size="sm" variant="outline" disabled={pay.isPending} onClick={() => pay.mutate(l.id)}>Fine paid</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

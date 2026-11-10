import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errMsg } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  head: () => ({ meta: [
    { title: "Borrow Requests — Meridian College Library" },
    { name: "description", content: "Approve or reject student borrow requests." },
    { property: "og:title", content: "Borrow Requests — Meridian College Library" },
    { property: "og:description", content: "Review and manage student requests for library books." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminRequests,
});

const FILTERS = ["pending", "approved", "rejected", "cancelled"] as const;

function AdminRequests() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("pending");
  const q = useQuery({
    queryKey: ["admin-requests", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrow_requests")
        .select("id,status,requested_at,note,books(title,author,available_copies),profiles!borrow_requests_student_id_fkey(full_name,student_id,email)")
        .eq("status", status)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const act = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = approve
        ? await supabase.rpc("approve_request", { _request_id: id })
        : await supabase.rpc("reject_request", { _request_id: id });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Approved and book issued" : "Request rejected");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <PageHeader title="Borrow requests" description="Approving a request issues the book to the student." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={f === status ? "default" : "outline"} onClick={() => setStatus(f)} className="capitalize">{f}</Button>
        ))}
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorNote error={q.error} /> : !q.data?.length ? (
        <EmptyState title={`No ${status} requests`} />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Book</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {q.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><div className="font-medium">{r.profiles?.full_name}</div><div className="text-xs text-muted-foreground">{r.profiles?.student_id ?? r.profiles?.email}</div></TableCell>
                  <TableCell><div className="font-medium">{r.books?.title}</div><div className="text-xs text-muted-foreground">{r.books?.available_copies} available</div></TableCell>
                  <TableCell>{new Date(r.requested_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, approve: true })}><Check className="mr-1 h-4 w-4" />Approve</Button>
                        <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, approve: false })}><X className="mr-1 h-4 w-4" />Reject</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

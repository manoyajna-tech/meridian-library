import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errMsg } from "@/lib/library";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Students — Meridian College Library" }, { name: "description", content: "Manage student accounts and roles." }] }),
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r, l] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("loans").select("student_id,status"),
      ]);
      if (p.error) throw p.error;
      const admins = new Set((r.data ?? []).filter((x) => x.role === "admin").map((x) => x.user_id));
      const active = new Map<string, number>(); const total = new Map<string, number>();
      for (const x of l.data ?? []) {
        total.set(x.student_id, (total.get(x.student_id) ?? 0) + 1);
        if (x.status === "active") active.set(x.student_id, (active.get(x.student_id) ?? 0) + 1);
      }
      return p.data.map((u) => ({ ...u, isAdmin: admins.has(u.id), active: active.get(u.id) ?? 0, total: total.get(u.id) ?? 0 }));
    },
  });
  const status = useMutation({
    mutationFn: async (v: { id: string; s: string }) => {
      const { error } = await supabase.rpc("set_student_status", { _user_id: v.id, _status: v.s });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Account updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const role = useMutation({
    mutationFn: async (v: { id: string; make: boolean }) => {
      const { error } = await supabase.rpc("set_user_admin", { _user_id: v.id, _make_admin: v.make });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const s = search.toLowerCase();
  const rows = (q.data ?? []).filter((u) => !s || [u.full_name, u.email, u.student_id, u.department].some((v) => v?.toLowerCase().includes(s)));

  return (
    <div>
      <PageHeader title="Students & users" description="Search accounts, suspend access, and manage admin roles." />
      <Input placeholder="Search by name, email, student ID or department" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-md" />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorNote error={q.error} /> : !rows.length ? <EmptyState title="No users found" /> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Student ID</TableHead><TableHead>Department</TableHead><TableHead>Borrowed</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((u) => {
                const self = u.id === user?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell><div className="font-medium">{u.full_name} {u.isAdmin && <Badge className="ml-1">Admin</Badge>}</div><div className="text-xs text-muted-foreground">{u.email}</div></TableCell>
                    <TableCell>{u.student_id ?? "—"}</TableCell>
                    <TableCell>{u.department ?? "—"}</TableCell>
                    <TableCell>{u.active} now · {u.total} total</TableCell>
                    <TableCell><Badge variant={u.account_status === "active" ? "secondary" : "destructive"} className="capitalize">{u.account_status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {!self && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={status.isPending} onClick={() => status.mutate({ id: u.id, s: u.account_status === "active" ? "suspended" : "active" })}>
                            {u.account_status === "active" ? "Deactivate" : "Activate"}
                          </Button>
                          <Button size="sm" variant="outline" disabled={role.isPending} onClick={() => role.mutate({ id: u.id, make: !u.isAdmin })}>
                            {u.isAdmin ? "Remove admin" : "Make admin"}
                          </Button>
                        </div>
                      )}
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

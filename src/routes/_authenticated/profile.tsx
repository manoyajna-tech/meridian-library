import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/library/AppShell";
import { PageHeader, Spinner, StatusBadge } from "@/components/library/bits";
import { FieldError } from "@/components/library/AuthCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/lib/auth";
import { DEPARTMENTS, errMsg, fmtDate } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Account settings — Meridian College Library" }, { name: "description", content: "Manage your profile and password." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: p, isLoading } = useProfile(userId);
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwErr, setPwErr] = useState<string>();
  useEffect(() => { if (p) { setName(p.full_name); setDept(p.department ?? ""); } }, [p]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Enter your full name");
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), department: dept || null }).eq("id", userId);
    if (error) return toast.error(errMsg(error));
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }
  async function changePw(e: FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8 || !/[0-9]/.test(pw.next) || !/[A-Za-z]/.test(pw.next)) return setPwErr("Use at least 8 characters with letters and numbers");
    setPwErr(undefined);
    const { error } = await supabase.auth.updateUser({ password: pw.next, current_password: pw.current } as { password: string });
    if (error) return toast.error(error.message);
    toast.success("Password changed");
    setPw({ current: "", next: "" });
  }

  if (isLoading || !p) return <AppShell><Spinner /></AppShell>;
  return (
    <AppShell>
      <PageHeader title="Account settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display text-xl font-medium">Profile</CardTitle></CardHeader>
          <CardContent>
            <dl className="mb-6 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Email</dt><dd>{p.email}</dd></div>
              <div><dt className="text-muted-foreground">Student ID</dt><dd>{p.student_id ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Member since</dt><dd>{fmtDate(p.created_at)}</dd></div>
              <div><dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={p.account_status} /></dd></div>
            </dl>
            <form onSubmit={saveProfile} className="space-y-4">
              <div><Label htmlFor="n">Full name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div>
                <Label>Department</Label>
                <Select value={dept} onValueChange={setDept}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="submit">Save changes</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-xl font-medium">Change password</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={changePw} className="space-y-4">
              <div><Label htmlFor="c">Current password</Label><Input id="c" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
              <div><Label htmlFor="x">New password</Label><Input id="x" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><FieldError msg={pwErr} /></div>
              <Button type="submit">Update password</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

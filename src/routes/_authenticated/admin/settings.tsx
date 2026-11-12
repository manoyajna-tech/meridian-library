import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ErrorNote, PageHeader, Spinner } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errMsg } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [
    { title: "Library Settings — Meridian College Library" },
    { name: "description", content: "Configure loan period, borrowing limit and fines." },
    { property: "og:title", content: "Library Settings — Meridian College Library" },
    { property: "og:description", content: "Set library loan limits, periods, and fine rates." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminSettings,
});

function AdminSettings() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["library-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("library_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({ days: "14", max: "3", fine: "5" });
  useEffect(() => {
    if (q.data) setForm({ days: String(q.data.borrowing_period_days), max: String(q.data.max_books_per_student), fine: String(q.data.fine_per_day) });
  }, [q.data]);
  const save = useMutation({
    mutationFn: async () => {
      const days = Number(form.days), max = Number(form.max), fine = Number(form.fine);
      if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Loan period must be 1–365 days");
      if (!Number.isInteger(max) || max < 1 || max > 50) throw new Error("Book limit must be 1–50");
      if (!(fine >= 0)) throw new Error("Fine must be 0 or more");
      const { error } = await supabase.from("library_settings").update({ borrowing_period_days: days, max_books_per_student: max, fine_per_day: fine, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["library-settings"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <PageHeader title="Settings" description="Rules that apply to every new loan." />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorNote error={q.error} /> : (
        <form className="max-w-md space-y-4 rounded-lg border bg-card p-6" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div><Label htmlFor="d">Loan period (days)</Label><Input id="d" type="number" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></div>
          <div><Label htmlFor="m">Max books per student</Label><Input id="m" type="number" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} /></div>
          <div><Label htmlFor="f">Fine per overdue day (₹)</Label><Input id="f" type="number" step="0.5" value={form.fine} onChange={(e) => setForm({ ...form, fine: e.target.value })} /></div>
          <Button type="submit" disabled={save.isPending}>Save settings</Button>
        </form>
      )}
    </div>
  );
}

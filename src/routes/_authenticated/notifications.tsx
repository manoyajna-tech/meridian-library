import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/library/AppShell";
import { EmptyState, PageHeader, Spinner } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Meridian College Library" }, { name: "description", content: "Your library notifications." }] }),
  component: Notifications,
});

function Notifications() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", userId, "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const mark = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
  const unread = data?.filter((n) => !n.is_read) ?? [];
  return (
    <AppShell>
      <PageHeader title="Notifications" description={`${unread.length} unread`}>
        {unread.length > 0 && <Button variant="outline" onClick={() => mark.mutate(unread.map((n) => n.id))}>Mark all as read</Button>}
      </PageHeader>
      {isLoading ? <Spinner /> : !data?.length ? <EmptyState icon={<Bell className="h-8 w-8" />} title="No notifications yet">Updates about your requests and loans will show up here.</EmptyState> : (
        <div className="divide-y rounded-xl border bg-card">
          {data.map((n) => (
            <div key={n.id} className={cn("flex items-start justify-between gap-4 p-4", !n.is_read && "bg-primary-soft/50")}>
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && <Button size="sm" variant="ghost" onClick={() => mark.mutate([n.id])}>Mark read</Button>}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/library/AppShell";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: () => (
    <AppShell admin>
      <Outlet />
    </AppShell>
  ),
});

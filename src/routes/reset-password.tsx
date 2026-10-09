import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, FieldError } from "@/components/library/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Meridian College Library" },
      { name: "description", content: "Set a new password for your library account." },
      { property: "og:title", content: "Reset password — Meridian College Library" },
      { property: "og:description", content: "Set a new password for your account." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session && isRecovery) setReady(true); if (data.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8 || !/[0-9]/.test(pw) || !/[A-Za-z]/.test(pw)) return setErr("Use at least 8 characters with letters and numbers");
    if (pw !== confirm) return setErr("Passwords do not match");
    setErr(undefined);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthCard title="Choose a new password">
      {!ready ? (
        <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Open this page from the reset link in your email. If the link expired, request a new one.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div><Label htmlFor="pw">New password</Label><Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div><Label htmlFor="cf">Confirm password</Label><Input id="cf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /><FieldError msg={err} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update password</Button>
        </form>
      )}
    </AuthCard>
  );
}

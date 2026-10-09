import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, FieldError } from "@/components/library/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — Meridian College Library" },
      { name: "description", content: "Reset the password for your library account." },
      { property: "og:title", content: "Forgot password — Meridian College Library" },
      { property: "og:description", content: "Reset your library account password." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Enter a valid email address");
    setErr(undefined);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  }
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a secure link to choose a new password.">
      {sent ? (
        <p className="rounded-md bg-primary-soft p-4 text-sm">If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldError msg={err} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="text-primary hover:underline">Back to login</Link></p>
    </AuthCard>
  );
}

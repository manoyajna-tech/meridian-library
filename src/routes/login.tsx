import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, FieldError } from "@/components/library/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Login — Meridian College Library" },
      { name: "description", content: "Sign in to your Meridian College Library account." },
      { property: "og:title", content: "Login — Meridian College Library" },
      { property: "og:description", content: "Sign in to manage your loans and requests." },
    ],
  }),
  component: Login,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      setBusy(false);
      toast.error(error.message === "Invalid login credentials" ? "Incorrect email or password" : error.message);
      return;
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    toast.success("Welcome back!");
    navigate({ to: redirect ?? (isAdmin ? "/admin" : "/dashboard") });
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in with your college email to continue.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FieldError msg={errors.email} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <FieldError msg={errors.password} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">New here? <Link to="/register" className="text-primary hover:underline">Create an account</Link></p>
    </AuthCard>
  );
}

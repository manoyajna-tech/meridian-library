import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, FieldError } from "@/components/library/AuthCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: typeof s["redirect"] === "string" && s["redirect"].startsWith("/") && !s["redirect"].startsWith("//") ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Login — Meridian College Library" },
      { name: "description", content: "Sign in to your Meridian College Library account." },
      { property: "og:title", content: "Login — Meridian College Library" },
      { property: "og:description", content: "Sign in to manage your loans and requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const REMEMBER_KEY = "meridian-remembered-email";

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({
    email: typeof window !== "undefined" ? (localStorage.getItem(REMEMBER_KEY) ?? "") : "",
    password: "",
  }));
  const [remember, setRemember] = useState(() => typeof window !== "undefined" && !!localStorage.getItem(REMEMBER_KEY));
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    sessionStorage.setItem("meridian-google-redirect", redirect ?? "");
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        sessionStorage.removeItem("meridian-google-redirect");
        setBusy(false);
        toast.error(result.error.message);
        return;
      }
      if (result.redirected) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        sessionStorage.removeItem("meridian-google-redirect");
        setBusy(false);
        toast.error("Google sign-in did not complete. Please try again.");
        return;
      }
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      sessionStorage.removeItem("meridian-google-redirect");
      toast.success("Welcome to Meridian Library!");
      navigate({ to: redirect ?? (isAdmin ? "/admin" : "/dashboard") });
    } catch {
      sessionStorage.removeItem("meridian-google-redirect");
      setBusy(false);
      toast.error("Google sign-in could not start. Please try again.");
    }
  }

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
    if (remember) localStorage.setItem(REMEMBER_KEY, parsed.data.email);
    else localStorage.removeItem(REMEMBER_KEY);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    toast.success("Welcome back!");
    navigate({ to: redirect ?? (isAdmin ? "/admin" : "/dashboard") });
  }

  return (
    <AuthCard title="Welcome to Meridian Library" subtitle="Your Gateway to Knowledge — sign in with your college email to continue.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FieldError msg={errors.email} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-secondary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError msg={errors.password} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">Remember me</Label>
        </div>
        <Button type="submit" className="w-full transition-all hover:shadow-lift" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
        </Button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span>OR</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 border-[#747775] bg-white px-3 font-medium text-[#1F1F1F] hover:bg-[#F2F2F2]"
        disabled={busy}
        onClick={signInWithGoogle}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
          <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
        </svg>
        Sign in with Google
      </Button>
      <p className="mt-6 text-center text-sm text-muted-foreground">New here? <Link to="/register" className="text-secondary hover:underline">Create an account</Link></p>
    </AuthCard>
  );
}

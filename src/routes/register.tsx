import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, FieldError } from "@/components/library/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/library";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register — Meridian College Library" },
      { name: "description", content: "Create your student library account to borrow books online." },
      { property: "og:title", content: "Register — Meridian College Library" },
      { property: "og:description", content: "Create your student library account." },
    ],
  }),
  component: Register,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(255),
  student_id: z.string().trim().regex(/^[A-Za-z0-9-]{3,20}$/, "Student ID must be 3–20 letters, numbers or dashes"),
  department: z.string().min(1, "Choose your department"),
  password: z.string().min(8, "Password must be at least 8 characters").regex(/[0-9]/, "Include at least one number").regex(/[A-Za-z]/, "Include at least one letter"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

function Register() {
  const [form, setForm] = useState({ full_name: "", email: "", student_id: "", department: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const up = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const { full_name, email, student_id, department, password } = parsed.data;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name, student_id: student_id.toUpperCase(), department } },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("Database error") ? "That student ID is already registered." : error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle="One last step">
        <div className="rounded-xl border bg-card p-6 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-sm">We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account, then sign in.</p>
          <Button asChild className="mt-5"><Link to="/login">Go to login</Link></Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Register with your student details to start borrowing.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" autoComplete="name" value={form.full_name} onChange={up("full_name")} />
          <FieldError msg={errors.full_name} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={up("email")} />
          <FieldError msg={errors.email} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="student_id">Student ID</Label>
            <Input id="student_id" value={form.student_id} onChange={up("student_id")} placeholder="e.g. CS2024-017" />
            <FieldError msg={errors.student_id} />
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
              <SelectTrigger id="department"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
            <FieldError msg={errors.department} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={up("password")} />
            <FieldError msg={errors.password} />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={up("confirm")} />
            <FieldError msg={errors.confirm} />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">Already registered? <Link to="/login" className="text-primary hover:underline">Sign in</Link></p>
    </AuthCard>
  );
}

import { useState, type ReactNode } from "react";
import { BookOpen, Library, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-gold text-navy">
        <Library className="h-5 w-5" />
      </span>
      <span className={cn("font-display text-lg font-semibold leading-tight", light ? "text-navy-foreground" : "text-primary")}>
        Meridian <span className="font-normal opacity-80">Library</span>
      </span>
    </Link>
  );
}

export function BookCover({ src, title, className }: { src?: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-md bg-primary p-3 text-center text-primary-foreground", className)}>
        <BookOpen className="h-6 w-6 text-gold" />
        <span className="line-clamp-3 font-display text-sm">{title}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`Cover of ${title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      onLoad={(e) => {
        // Open Library returns a 1x1 image when a cover is missing
        if ((e.target as HTMLImageElement).naturalWidth < 10) setFailed(true);
      }}
      className={cn("aspect-[2/3] w-full rounded-md bg-muted object-cover", className)}
    />
  );
}

export function Availability({ available, total }: { available: number; total: number }) {
  if (available > 0)
    return <Badge className="bg-success text-success-foreground hover:bg-success">{available} of {total} available</Badge>;
  return <Badge variant="destructive">All copies borrowed</Badge>;
}

export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) return <Badge variant="destructive">Overdue</Badge>;
  const map: Record<string, string> = {
    pending: "bg-warning text-warning-foreground hover:bg-warning",
    approved: "bg-success text-success-foreground hover:bg-success",
    active: "bg-primary text-primary-foreground hover:bg-primary",
    returned: "bg-secondary text-secondary-foreground hover:bg-secondary",
    rejected: "bg-destructive text-destructive-foreground hover:bg-destructive",
    cancelled: "bg-muted text-muted-foreground hover:bg-muted",
    suspended: "bg-destructive text-destructive-foreground hover:bg-destructive",
  };
  return <Badge className={cn("capitalize", map[status])}>{status}</Badge>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-12 text-center">
      <div className="mb-3 text-muted-foreground">{icon ?? <BookOpen className="h-8 w-8" />}</div>
      <p className="font-display text-lg text-foreground">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "Could not load data.";
  return <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{msg}</div>;
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "default" }: { label: string; value: ReactNode; icon: ReactNode; tone?: "default" | "warn" | "danger" | "good" }) {
  const tones = {
    default: "bg-primary-soft text-primary",
    warn: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
    good: "bg-success/15 text-success",
  };
  return (
    <div className="fade-up rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("grid h-9 w-9 place-items-center rounded-md", tones[tone])}>{icon}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

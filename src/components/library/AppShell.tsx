import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlarmClock, ArrowDownToLine, ArrowUpFromLine, BarChart3, Bell, BookCopy, BookOpen, ClipboardList, FolderTree,
  Home, LayoutDashboard, Menu, Settings, User, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsAdmin, useSession } from "@/lib/auth";
import { Logo } from "./bits";
import { GlobalSearch, NotificationBell, UserMenu } from "./header-widgets";

const ADMIN = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/books", label: "Manage Books", icon: BookCopy },
  { to: "/admin/categories", label: "Manage Categories", icon: FolderTree },
  { to: "/admin/students", label: "Manage Students", icon: Users },
  { to: "/admin/issue", label: "Issue Books", icon: ArrowUpFromLine },
  { to: "/admin/returns", label: "Return Books", icon: ArrowDownToLine },
  { to: "/admin/requests", label: "Borrow Requests", icon: ClipboardList },
  { to: "/admin/overdue", label: "Overdue Books", icon: AlarmClock },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

const STUDENT = [
  { to: "/dashboard", label: "My Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/books", label: "Browse Catalog", icon: BookOpen },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function NavList({ admin, onNavigate }: { admin: boolean; onNavigate?: () => void }) {
  const items = admin ? ADMIN : STUDENT;
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Sidebar">
      {items.map((it) => (
        <Link key={it.to} to={it.to} onClick={onNavigate} activeOptions={{ exact: "exact" in it && it.exact }}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}>
          <it.icon className="h-4 w-4" />{it.label}
        </Link>
      ))}
      <div className="my-3 border-t border-sidebar-border" />
      {admin ? (
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent">
          <User className="h-4 w-4" />My student view
        </Link>
      ) : null}
      <Link to="/" onClick={onNavigate} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent">
        <Home className="h-4 w-4" />Library home
      </Link>
    </nav>
  );
}

export function AppShell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar py-5 lg:flex">
        <div className="mb-6 px-6"><Logo light /></div>
        {admin && <p className="mb-2 px-6 text-xs uppercase tracking-wider text-sidebar-primary">Administration</p>}
        <NavList admin={admin} />
        {!admin && isAdmin && (
          <div className="mt-auto px-6"><Button variant="secondary" size="sm" asChild className="w-full"><Link to="/admin">Go to admin</Link></Button></div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0 py-5">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="mb-6 px-6"><Logo light /></div>
              <NavList admin={admin} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <GlobalSearch className="w-full max-w-md" />
          <div className="ml-auto flex items-center gap-1">
            {user && <NotificationBell userId={user.id} />}
            {user && <UserMenu userId={user.id} />}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

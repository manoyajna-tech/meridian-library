import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Menu, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useSession } from "@/lib/auth";
import { Logo } from "./bits";
import { NotificationBell, UserMenu } from "./header-widgets";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/books", label: "Browse Books" },
  { to: "/categories", label: "Categories" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Logo />
          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-primary font-medium" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {!loading && user ? (
              <>
                <NotificationBell userId={user.id} />
                <UserMenu userId={user.id} />
              </>
            ) : (
              <div className="hidden gap-2 sm:flex">
                <Button variant="ghost" asChild><Link to="/login">Login</Link></Button>
                <Button asChild><Link to="/register">Register</Link></Button>
              </div>
            )}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <nav className="mt-8 flex flex-col gap-1">
                  {NAV.map((n) => (
                    <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">{n.label}</Link>
                  ))}
                  {!user && (
                    <>
                      <Link to="/login" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">Login</Link>
                      <Link to="/register" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">Register</Link>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-navy text-navy-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo light />
            <p className="mt-4 max-w-sm text-sm opacity-75">The digital home of Meridian College Library — search the collection, request books, and track your loans from anywhere.</p>
          </div>
          <div>
            <p className="mb-3 font-display text-lg">Useful links</p>
            <ul className="space-y-2 text-sm opacity-80">
              <li><Link to="/books" className="hover:underline">Browse catalog</Link></li>
              <li><Link to="/categories" className="hover:underline">Categories</Link></li>
              <li><Link to="/about" className="hover:underline">About the library</Link></li>
              <li><Link to="/register" className="hover:underline">Become a member</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-display text-lg">Contact</p>
            <ul className="space-y-2 text-sm opacity-80">
              <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0" />Central Block, Meridian College Campus</li>
              <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0" />+91 40 1234 5678</li>
              <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0" />library@meridian.edu</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-sidebar-border py-4 text-center text-xs opacity-60">© {new Date().getFullYear()} Meridian College Library</div>
      </footer>
    </div>
  );
}

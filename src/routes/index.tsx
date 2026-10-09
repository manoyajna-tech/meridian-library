import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Atom, BellRing, BookMarked, BookOpen, Calculator, Clock, Code2, Cpu, Globe2, Library, Search, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/library/PublicLayout";
import { BookCard } from "@/components/library/BookCard";
import { GlobalSearch } from "@/components/library/header-widgets";
import { Spinner } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero-library.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meridian College Library — Your Digital Library, Anytime, Anywhere" },
      { name: "description", content: "Search the Meridian College Library catalog, request books online and track your loans and due dates." },
      { property: "og:title", content: "Meridian College Library" },
      { property: "og:description", content: "Your digital library, anytime, anywhere. Search, request and track books online." },
    ],
  }),
  component: Home,
});

const CAT_ICONS: Record<string, typeof Code2> = {
  Programming: Code2,
  "Computer Science": Cpu,
  Mathematics: Calculator,
  Science: Atom,
  Literature: BookMarked,
  "General Knowledge": Globe2,
};

function Home() {
  const featured = useQuery({
    queryKey: ["featured-books"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("id,title,author,cover_image_url,available_copies,total_copies,categories(name)")
        .eq("is_archived", false).order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });
  const cats = useQuery({
    queryKey: ["categories-with-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,description,books(count)").order("name");
      if (error) throw error;
      return data;
    },
  });
  const stats = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_stats");
      if (error) throw error;
      return data as { total_books: number; titles: number; available_books: number; members: number };
    },
  });

  return (
    <PublicLayout>
      <section className="relative isolate overflow-hidden">
        <img src={hero} alt="" width={1600} height={912} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="bg-hero-overlay absolute inset-0 -z-10" />
        <div className="mx-auto max-w-7xl px-4 py-24 md:py-36">
          <p className="fade-up text-sm uppercase tracking-[0.25em] text-gold">Meridian College Library</p>
          <h1 className="fade-up mt-4 max-w-3xl text-4xl font-medium leading-tight text-navy-foreground md:text-6xl">
            Your Digital Library, Anytime, Anywhere
          </h1>
          <p className="fade-up mt-5 max-w-xl text-lg text-navy-foreground/80">
            Search thousands of copies, request books in a click, and keep track of every due date — all in one place.
          </p>
          <div className="fade-up mt-8 max-w-xl">
            <GlobalSearch className="[&_input]:h-12 [&_input]:text-base" />
            <p className="mt-2 text-xs text-navy-foreground/70">Search by title, author, ISBN or category</p>
          </div>
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4">
          {[
            { label: "Total books", value: stats.data?.total_books, icon: Library },
            { label: "Unique titles", value: stats.data?.titles, icon: BookOpen },
            { label: "Available now", value: stats.data?.available_books, icon: BookMarked },
            { label: "Registered members", value: stats.data?.members, icon: Users },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-primary-soft text-primary"><s.icon className="h-5 w-5" /></span>
              <div>
                <p className="font-display text-2xl font-semibold">{stats.isLoading ? "…" : (s.value ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-medium">Featured books</h2>
            <p className="text-muted-foreground">Recently added to the collection</p>
          </div>
          <Button variant="outline" asChild><Link to="/books">View all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        {featured.isLoading ? <Spinner /> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
            {featured.data?.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        )}
      </section>

      <section className="bg-primary-soft/50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-medium">Popular categories</h2>
          <p className="mb-8 text-muted-foreground">Explore the shelves by subject</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cats.data?.map((c) => {
              const Icon = CAT_ICONS[c.name] ?? BookOpen;
              const count = (c.books as unknown as { count: number }[])?.[0]?.count ?? 0;
              return (
                <Link key={c.id} to="/books" search={{ category: c.id }} className="lift flex items-start gap-4 rounded-xl border bg-card p-5 shadow-card">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary text-gold"><Icon className="h-6 w-6" /></span>
                  <div>
                    <p className="font-display text-lg font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                    <p className="mt-1 text-xs text-primary">{count} titles</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-medium">Library services</h2>
        <p className="mb-8 text-muted-foreground">Everything you need, without the queue at the counter</p>
        <div className="grid gap-6 md:grid-cols-4">
          {[
            { icon: Search, t: "Online catalog", d: "Search the full collection and check live availability." },
            { icon: BookMarked, t: "Request & borrow", d: "Request a book online and collect it once approved." },
            { icon: Clock, t: "Track due dates", d: "See every loan, due date and fine in your dashboard." },
            { icon: BellRing, t: "Smart reminders", d: "Get notified before books are due and when requests change." },
          ].map((s) => (
            <div key={s.t} className="rounded-xl border bg-card p-6 shadow-card">
              <s.icon className="h-7 w-7 text-primary" />
              <p className="mt-4 font-display text-lg font-medium">{s.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl bg-navy p-8 text-navy-foreground md:flex-row md:items-center">
          <div>
            <p className="font-display text-2xl">New to the library?</p>
            <p className="opacity-80">Register with your student ID and start borrowing today.</p>
          </div>
          <Button size="lg" variant="secondary" asChild><Link to="/register">Create your account</Link></Button>
        </div>
      </section>
    </PublicLayout>
  );
}

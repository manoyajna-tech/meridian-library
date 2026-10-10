import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LayoutGrid, List, SearchX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/library/PublicLayout";
import { BookCard, BookRow } from "@/components/library/BookCard";
import { EmptyState, ErrorNote, Spinner } from "@/components/library/bits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Search = { q?: string | undefined; category?: string | undefined; avail?: "available" | "borrowed" | undefined; sort?: "title" | "author" | "year" | undefined; page?: number | undefined; view?: "grid" | "list" | undefined };
const PAGE = 12;

export const Route = createFileRoute("/books/")({
  validateSearch: (raw: Record<string, unknown>): Search => { const s = raw as { q?: unknown; category?: unknown; avail?: unknown; sort?: unknown; page?: unknown; view?: unknown }; return ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    category: typeof s.category === "string" && s.category ? s.category : undefined,
    avail: s.avail === "available" || s.avail === "borrowed" ? s.avail : undefined,
    sort: s.sort === "author" || s.sort === "year" ? s.sort : s.sort === "title" ? "title" : undefined,
    page: Number(s.page) > 1 ? Math.floor(Number(s.page)) : undefined,
    view: s.view === "list" ? "list" : undefined,
  }); },
  head: () => ({
    meta: [
      { title: "Browse Books — Meridian College Library" },
      { name: "description", content: "Search the full library catalog by title, author, ISBN or keyword and check live availability." },
      { property: "og:title", content: "Browse Books — Meridian College Library" },
      { property: "og:description", content: "Search the catalog and check live availability." },
    ],
  }),
  component: Catalog,
});

export function sanitizeTerm(q: string) {
  return q.replace(/[,()%*\\]/g, " ").trim();
}

function Catalog() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/books/" });
  const set = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }) });
  const [term, setTerm] = useState(search.q ?? "");
  useEffect(() => setTerm(search.q ?? ""), [search.q]);
  useEffect(() => {
    const t = setTimeout(() => { if ((search.q ?? "") !== term) set({ q: term || undefined }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id,name").order("name")).data ?? [],
  });
  const page = search.page ?? 1;
  const books = useQuery({
    queryKey: ["catalog", search],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from("books").select("id,title,author,isbn,publication_year,cover_image_url,available_copies,total_copies,categories(name)", { count: "exact" })
        .eq("is_archived", false);
      const t = sanitizeTerm(search.q ?? "");
      if (t) q = q.or(`title.ilike.%${t}%,author.ilike.%${t}%,isbn.ilike.%${t}%,description.ilike.%${t}%,publisher.ilike.%${t}%`);
      if (search.category) q = q.eq("category_id", search.category);
      if (search.avail === "available") q = q.gt("available_copies", 0);
      if (search.avail === "borrowed") q = q.eq("available_copies", 0);
      const col = search.sort === "author" ? "author" : search.sort === "year" ? "publication_year" : "title";
      q = q.order(col, { ascending: col !== "publication_year" }).range((page - 1) * PAGE, page * PAGE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
  const pages = Math.max(1, Math.ceil((books.data?.count ?? 0) / PAGE));

  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-4xl font-medium">Browse the catalog</h1>
        <p className="mt-1 text-muted-foreground">{books.data ? `${books.data.count} books found` : "Searching…"}</p>

        <div className="mt-6 grid gap-3 rounded-xl border bg-card p-4 shadow-card md:grid-cols-[1fr_auto_auto_auto_auto]">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search title, author, ISBN or keyword" aria-label="Search" />
          <Select value={search.category ?? "all"} onValueChange={(v) => set({ category: v === "all" ? undefined : v })}>
            <SelectTrigger className="md:w-48" aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {cats.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={search.avail ?? "all"} onValueChange={(v) => set({ avail: v === "all" ? undefined : (v as Search["avail"]) })}>
            <SelectTrigger className="md:w-40" aria-label="Availability"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any availability</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="borrowed">All borrowed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={search.sort ?? "title"} onValueChange={(v) => set({ sort: v as Search["sort"] })}>
            <SelectTrigger className="md:w-40" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Sort: Title</SelectItem>
              <SelectItem value="author">Sort: Author</SelectItem>
              <SelectItem value="year">Sort: Newest</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button variant={search.view !== "list" ? "default" : "outline"} size="icon" aria-label="Grid view" onClick={() => navigate({ search: (p) => ({ ...p, view: undefined }) })}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={search.view === "list" ? "default" : "outline"} size="icon" aria-label="List view" onClick={() => navigate({ search: (p) => ({ ...p, view: "list" }) })}><List className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mt-8">
          {books.isLoading ? <Spinner /> : books.error ? <ErrorNote error={books.error} /> : books.data!.rows.length === 0 ? (
            <EmptyState icon={<SearchX className="h-8 w-8" />} title="No books match your search">Try a different keyword or clear the filters.</EmptyState>
          ) : search.view === "list" ? (
            <div className="space-y-3">{books.data!.rows.map((b) => <BookRow key={b.id} book={b} />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{books.data!.rows.map((b) => <BookCard key={b.id} book={b} />)}</div>
          )}
        </div>

        {pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ search: (p) => ({ ...p, page: page - 1 > 1 ? page - 1 : undefined }) })}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
            <Button variant="outline" disabled={page >= pages} onClick={() => navigate({ search: (p) => ({ ...p, page: page + 1 }) })}>Next</Button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/library/PublicLayout";
import { EmptyState, Spinner } from "@/components/library/bits";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Categories — Meridian College Library" },
      { name: "description", content: "Explore the library collection by subject: programming, computer science, mathematics, science, literature and more." },
      { property: "og:title", content: "Categories — Meridian College Library" },
      { property: "og:description", content: "Explore the collection by subject." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Categories,
});

function Categories() {
  const { data, isLoading } = useQuery({
    queryKey: ["categories-with-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,description,books(count)").order("name");
      if (error) throw error;
      return data;
    },
  });
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <h1 className="text-4xl font-medium">Categories</h1>
        <p className="mb-8 mt-1 text-muted-foreground">Browse the shelves by subject</p>
        {isLoading ? <Spinner /> : !data?.length ? <EmptyState title="No categories yet" /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => (
              <Link key={c.id} to="/books" search={{ category: c.id }} className="lift rounded-xl border bg-card p-6 shadow-card">
                <BookOpen className="h-6 w-6 text-primary" />
                <p className="mt-3 font-display text-xl font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.description}</p>
                <p className="mt-2 text-xs text-primary">{(c.books as unknown as { count: number }[])?.[0]?.count ?? 0} titles →</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

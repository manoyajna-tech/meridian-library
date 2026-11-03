import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/library/AppShell";
import { BookCard } from "@/components/library/BookCard";
import { EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/library/bits";

export const Route = createFileRoute("/_authenticated/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Meridian College Library" }, { name: "description", content: "Your saved books." }] }),
  component: Wishlist,
});

function Wishlist() {
  const { userId } = Route.useRouteContext();
  const data = useQuery({
    queryKey: ["wishlist", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlists")
        .select("book_id, books(id,title,author,cover_image_url,available_copies,total_copies,is_archived,categories(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((w) => w.books).filter((b) => b && !b.is_archived);
    },
  });

  return (
    <AppShell>
      <PageHeader title="My wishlist" description="Books you've saved for later." />
      {data.isLoading ? (
        <Spinner />
      ) : data.error ? (
        <ErrorNote error={data.error} />
      ) : !data.data?.length ? (
        <EmptyState icon={<Heart className="h-8 w-8" />} title="Your wishlist is empty">
          Browse the catalog and tap "Save to wishlist" on any book.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.data.map((b) => b && <BookCard key={b.id} book={b} />)}
        </div>
      )}
    </AppShell>
  );
}

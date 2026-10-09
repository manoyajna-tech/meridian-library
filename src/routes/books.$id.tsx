import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/library/PublicLayout";
import { Availability, BookCover, EmptyState, Spinner } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";
import { errMsg, fmtDate } from "@/lib/library";

export const Route = createFileRoute("/books/$id")({
  head: () => ({
    meta: [
      { title: "Book details — Meridian College Library" },
      { name: "description", content: "View book details, availability and request a copy from Meridian College Library." },
      { property: "og:title", content: "Book details — Meridian College Library" },
      { property: "og:description", content: "View availability and request this book." },
    ],
  }),
  component: BookDetail,
});

function BookDetail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();
  const book = useQuery({
    queryKey: ["book", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*, categories(name)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const mine = useQuery({
    queryKey: ["my-book-status", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [r, l] = await Promise.all([
        supabase.from("borrow_requests").select("id").eq("book_id", id).eq("student_id", user!.id).eq("status", "pending").maybeSingle(),
        supabase.from("loans").select("id,due_date").eq("book_id", id).eq("student_id", user!.id).eq("status", "active").maybeSingle(),
      ]);
      return { pending: !!r.data, loan: l.data };
    },
  });
  const request = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_book", { _book_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request submitted", { description: "You'll be notified once a librarian reviews it." });
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (book.isLoading) return <PublicLayout><Spinner /></PublicLayout>;
  const b = book.data;
  if (!b) return <PublicLayout><div className="mx-auto max-w-xl px-4 py-20"><EmptyState icon={<BookX className="h-8 w-8" />} title="Book not found"><Link to="/books" className="text-primary underline">Back to catalog</Link></EmptyState></div></PublicLayout>;

  const details: [string, string | number | null][] = [
    ["Author", b.author], ["Category", b.categories?.name ?? "—"], ["Publisher", b.publisher], ["Year", b.publication_year],
    ["ISBN", b.isbn], ["Shelf", b.shelf_location], ["Copies", `${b.available_copies} available of ${b.total_copies}`],
  ];

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link to="/books" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to catalog</Link>
        <div className="grid gap-10 md:grid-cols-[280px_1fr]">
          <div className="mx-auto w-full max-w-[280px]"><BookCover src={b.cover_image_url} title={b.title} className="shadow-lift" /></div>
          <div>
            {b.is_archived && <p className="mb-2 text-sm text-destructive">This title has been withdrawn from circulation.</p>}
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{b.categories?.name}</p>
            <h1 className="mt-1 text-4xl font-medium">{b.title}</h1>
            <p className="mt-1 text-lg text-muted-foreground">by {b.author}</p>
            <div className="mt-4"><Availability available={b.available_copies} total={b.total_copies} /></div>
            <p className="mt-6 leading-relaxed text-foreground/90">{b.description || "No description available."}</p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border bg-card p-5 text-sm sm:grid-cols-3">
              {details.map(([k, v]) => (
                <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v ?? "—"}</dd></div>
              ))}
            </dl>
            <div className="mt-6">
              {!user ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild size="lg"><Link to="/login" search={{ redirect: `/books/${b.id}` }}>Sign in to request</Link></Button>
                  <span className="text-sm text-muted-foreground">You need a library account to borrow books.</span>
                </div>
              ) : mine.data?.loan ? (
                <p className="rounded-md bg-primary-soft p-4 text-sm">You have this book on loan — due {fmtDate(mine.data.loan.due_date)}.</p>
              ) : mine.data?.pending ? (
                <p className="rounded-md bg-warning/20 p-4 text-sm">Your request is pending approval.</p>
              ) : b.available_copies > 0 && !b.is_archived ? (
                <Button size="lg" onClick={() => request.mutate()} disabled={request.isPending}>
                  {request.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request Book
                </Button>
              ) : (
                <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">All copies are currently borrowed. Please check back later.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

import { Link } from "@tanstack/react-router";
import type { Book } from "@/lib/library";
import { Availability, BookCover } from "./bits";

type B = Pick<Book, "id" | "title" | "author" | "cover_image_url" | "available_copies" | "total_copies"> & {
  categories?: { name: string } | null;
};

export function BookCard({ book }: { book: B }) {
  return (
    <Link to="/books/$id" params={{ id: book.id }} className="lift group flex flex-col rounded-xl border bg-card p-3 shadow-card">
      <BookCover src={book.cover_image_url} title={book.title} />
      <div className="mt-3 flex flex-1 flex-col">
        {book.categories?.name && <p className="text-xs uppercase tracking-wide text-muted-foreground">{book.categories.name}</p>}
        <p className="mt-0.5 line-clamp-2 font-display text-base font-medium leading-snug text-foreground group-hover:text-primary">{book.title}</p>
        <p className="line-clamp-1 text-sm text-muted-foreground">{book.author}</p>
        <div className="mt-auto pt-3"><Availability available={book.available_copies} total={book.total_copies} /></div>
      </div>
    </Link>
  );
}

export function BookRow({ book }: { book: B & { isbn?: string; publication_year?: number | null } }) {
  return (
    <Link to="/books/$id" params={{ id: book.id }} className="flex items-center gap-4 rounded-xl border bg-card p-3 shadow-card transition-colors hover:bg-muted/50">
      <div className="w-14 shrink-0"><BookCover src={book.cover_image_url} title={book.title} /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-medium">{book.title}</p>
        <p className="truncate text-sm text-muted-foreground">{book.author}{book.publication_year ? ` · ${book.publication_year}` : ""}</p>
        <p className="text-xs text-muted-foreground">{book.categories?.name}{book.isbn ? ` · ISBN ${book.isbn}` : ""}</p>
      </div>
      <Availability available={book.available_copies} total={book.total_copies} />
    </Link>
  );
}

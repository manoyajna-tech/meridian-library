import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Archive, Download, Loader2, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BookCover, EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/library/bits";
import { FieldError } from "@/components/library/AuthCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Book, Category } from "@/lib/library";
import { downloadCSV, errMsg } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/books")({
  head: () => ({ meta: [{ title: "Manage Books — Meridian College Library" }, { name: "description", content: "Add, edit and archive library books." }] }),
  component: AdminBooks,
});

const bookSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  author: z.string().trim().min(1, "Author is required"),
  isbn: z.string().trim().min(10, "ISBN must be at least 10 characters"),
  publisher: z.string().trim(),
  publication_year: z.string().trim(),
  description: z.string().trim(),
  shelf_location: z.string().trim(),
  total_copies: z.string().trim(),
  cover_image_url: z.string().trim(),
});

type FormState = z.infer<typeof bookSchema> & { category_id: string };

const emptyForm: FormState = {
  title: "", author: "", isbn: "", publisher: "", publication_year: "", description: "",
  shelf_location: "", total_copies: "1", cover_image_url: "", category_id: "",
};

function AdminBooks() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [editing, setEditing] = useState<Book | "new" | null>(null);
  const [removing, setRemoving] = useState<Book | null>(null);

  const books = useQuery({
    queryKey: ["admin-books"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*, categories(name)").order("title");
      if (error) throw error;
      return data;
    },
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("delete_or_archive_book", { _book_id: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (result) => {
      toast.success(result === "deleted" ? "Book deleted" : "Book archived (it has loan history)");
      setRemoving(null);
      qc.invalidateQueries({ queryKey: ["admin-books"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rows = (books.data ?? []).filter((b) => {
    const t = term.toLowerCase();
    return !t || b.title.toLowerCase().includes(t) || b.author.toLowerCase().includes(t) || b.isbn.includes(t);
  });

  return (
    <div>
      <PageHeader title="Books" description={`${books.data?.length ?? "…"} titles in the catalog`}>
        <Button variant="outline" onClick={() => downloadCSV("books.csv", rows.map((b) => ({ title: b.title, author: b.author, isbn: b.isbn, category: b.categories?.name, total: b.total_copies, available: b.available_copies, archived: b.is_archived })))}>
          <Download className="mr-2 h-4 w-4" />Export CSV
        </Button>
        <Button onClick={() => setEditing("new")}><Plus className="mr-2 h-4 w-4" />Add book</Button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search title, author or ISBN" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Search books" />
      </div>

      {books.isLoading ? <Spinner /> : books.error ? <ErrorNote error={books.error} /> : rows.length === 0 ? (
        <EmptyState title="No books found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead><TableHead>ISBN</TableHead><TableHead>Category</TableHead>
                <TableHead className="text-center">Copies</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id} className={b.is_archived ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 shrink-0"><BookCover src={b.cover_image_url} title={b.title} /></div>
                      <div className="min-w-0">
                        <p className="max-w-64 truncate font-medium">{b.title}</p>
                        <p className="max-w-64 truncate text-xs text-muted-foreground">{b.author}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{b.isbn}</TableCell>
                  <TableCell className="text-sm">{b.categories?.name ?? "—"}</TableCell>
                  <TableCell className="text-center text-sm">{b.available_copies} / {b.total_copies}</TableCell>
                  <TableCell>{b.is_archived ? <Badge variant="secondary">Archived</Badge> : b.available_copies > 0 ? <Badge className="bg-success text-success-foreground hover:bg-success">Available</Badge> : <Badge variant="destructive">All borrowed</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${b.title}`} onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete or archive ${b.title}`} onClick={() => setRemoving(b)}><Archive className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && <BookDialog book={editing === "new" ? null : editing} cats={cats.data ?? []} onClose={() => setEditing(null)} />}

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{removing?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              If the book has loan or request history it will be archived (hidden from the catalog) instead of deleted. Pending requests must be resolved first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && remove.mutate(removing.id)} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BookDialog({ book, cats, onClose }: { book: Book | null; cats: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(
    book
      ? {
          title: book.title, author: book.author, isbn: book.isbn, publisher: book.publisher ?? "",
          publication_year: book.publication_year?.toString() ?? "", description: book.description ?? "",
          shelf_location: book.shelf_location ?? "", total_copies: String(book.total_copies),
          cover_image_url: book.cover_image_url ?? "", category_id: book.category_id ?? "",
        }
      : emptyForm,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = bookSchema.safeParse(form);
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as keyof FormState, i.message])));
        throw new Error("validation");
      }
      const year = parsed.data.publication_year ? Number(parsed.data.publication_year) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 2100)) {
        setErrors({ publication_year: "Enter a valid year" });
        throw new Error("validation");
      }
      const copies = Number(parsed.data.total_copies);
      if (!Number.isInteger(copies) || copies < 1) {
        setErrors({ total_copies: "At least 1 copy required" });
        throw new Error("validation");
      }
      const payload = {
        title: parsed.data.title, author: parsed.data.author, isbn: parsed.data.isbn,
        publisher: parsed.data.publisher || null, publication_year: year,
        description: parsed.data.description || null, shelf_location: parsed.data.shelf_location || null,
        total_copies: copies, cover_image_url: parsed.data.cover_image_url || null,
        category_id: form.category_id || null,
      };
      if (book) {
        const { error } = await supabase.from("books").update(payload).eq("id", book.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("books").insert({ ...payload, available_copies: copies });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(book ? "Book updated" : "Book added");
      qc.invalidateQueries({ queryKey: ["admin-books"] });
      onClose();
    },
    onError: (e) => { if (errMsg(e) !== "validation") toast.error(errMsg(e)); },
  });

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `covers/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("book-covers").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage.from("book-covers").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;
      setForm((f) => ({ ...f, cover_image_url: data.signedUrl }));
      toast.success("Cover uploaded");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    save.mutate();
  }

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-display text-2xl">{book ? "Edit book" : "Add a new book"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2"><Label htmlFor="b-title">Title *</Label><Input id="b-title" value={form.title} onChange={set("title")} /><FieldError msg={errors.title} /></div>
          <div><Label htmlFor="b-author">Author *</Label><Input id="b-author" value={form.author} onChange={set("author")} /><FieldError msg={errors.author} /></div>
          <div><Label htmlFor="b-isbn">ISBN *</Label><Input id="b-isbn" value={form.isbn} onChange={set("isbn")} /><FieldError msg={errors.isbn} /></div>
          <div>
            <Label>Category</Label>
            <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
              <SelectTrigger aria-label="Category"><SelectValue placeholder="No category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="b-publisher">Publisher</Label><Input id="b-publisher" value={form.publisher} onChange={set("publisher")} /></div>
          <div><Label htmlFor="b-year">Publication year</Label><Input id="b-year" inputMode="numeric" value={form.publication_year} onChange={set("publication_year")} /><FieldError msg={errors.publication_year} /></div>
          <div><Label htmlFor="b-copies">Total copies *</Label><Input id="b-copies" inputMode="numeric" value={form.total_copies} onChange={set("total_copies")} /><FieldError msg={errors.total_copies} /></div>
          <div><Label htmlFor="b-shelf">Shelf location</Label><Input id="b-shelf" value={form.shelf_location} onChange={set("shelf_location")} /></div>
          <div className="sm:col-span-2">
            <Label htmlFor="b-cover">Cover image URL</Label>
            <div className="flex gap-2">
              <Input id="b-cover" placeholder="https://…" value={form.cover_image_url} onChange={set("cover_image_url")} />
              <Button type="button" variant="outline" disabled={uploading} asChild>
                <label className="cursor-pointer">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                </label>
              </Button>
            </div>
          </div>
          <div className="sm:col-span-2"><Label htmlFor="b-desc">Description</Label><Textarea id="b-desc" rows={3} value={form.description} onChange={set("description")} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{book ? "Save changes" : "Add book"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

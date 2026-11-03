import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/library/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Category } from "@/lib/library";
import { errMsg } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Categories — Meridian College Library" }, { name: "description", content: "Manage book categories." }] }),
  component: AdminCategories,
});

function AdminCategories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);

  const cats = useQuery({
    queryKey: ["admin-cats"],
    queryFn: async () => {
      const [{ data, error }, { data: books }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("books").select("category_id"),
      ]);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const b of books ?? []) if (b.category_id) counts.set(b.category_id, (counts.get(b.category_id) ?? 0) + 1);
      return data.map((c) => ({ ...c, bookCount: counts.get(c.id) ?? 0 }));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category deleted");
      setRemoving(null);
      qc.invalidateQueries({ queryKey: ["admin-cats"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <PageHeader title="Categories" description="Group books by subject.">
        <Button onClick={() => setEditing("new")}><Plus className="mr-2 h-4 w-4" />Add category</Button>
      </PageHeader>

      {cats.isLoading || !cats.data ? <Spinner /> : cats.error ? <ErrorNote error={cats.error} /> : cats.data.length === 0 ? (
        <EmptyState title="No categories yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-center">Books</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {cats.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="max-w-md truncate text-sm text-muted-foreground">{c.description ?? "—"}</TableCell>
                  <TableCell className="text-center text-sm">{c.bookCount}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setRemoving(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && <CategoryDialog cat={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{removing?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Books in this category will keep no category. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && remove.mutate(removing.id)} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryDialog({ cat, onClose }: { cat: Category | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(cat?.name ?? "");
  const [description, setDescription] = useState(cat?.description ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (cat) {
        const { error } = await supabase.from("categories").update({ name: name.trim(), description: description.trim() || null }).eq("id", cat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({ name: name.trim(), description: description.trim() || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(cat ? "Category updated" : "Category added");
      qc.invalidateQueries({ queryKey: ["admin-cats"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">{cat ? "Edit category" : "Add category"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div><Label htmlFor="c-name">Name *</Label><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="c-desc">Description</Label><Input id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errMsg } from "@/lib/library";

export function WishlistButton({ bookId, userId, className }: { bookId: string; userId: string | undefined; className?: string }) {
  const qc = useQueryClient();
  const key = ["wishlist", userId];
  const saved = useQuery({
    queryKey: [...key, bookId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("wishlists").select("id").eq("book_id", bookId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const toggle = useMutation({
    mutationFn: async () => {
      if (saved.data) {
        const { error } = await supabase.from("wishlists").delete().eq("book_id", bookId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wishlists").insert({ book_id: bookId, user_id: userId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(saved.data ? "Removed from wishlist" : "Saved to wishlist");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!userId) return null;
  return (
    <Button
      variant={saved.data ? "default" : "outline"}
      size="sm"
      className={cn("gap-2", className)}
      disabled={saved.isLoading || toggle.isPending}
      onClick={() => toggle.mutate()}
    >
      <Heart className={cn("h-4 w-4", saved.data && "fill-current")} />
      {saved.data ? "In wishlist" : "Save to wishlist"}
    </Button>
  );
}

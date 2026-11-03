CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);

GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own wishlist read" ON public.wishlists
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "own wishlist insert" ON public.wishlists
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "own wishlist delete" ON public.wishlists
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read all categories" ON public.categories
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
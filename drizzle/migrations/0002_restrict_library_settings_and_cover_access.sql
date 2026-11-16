DROP POLICY IF EXISTS "anyone reads settings" ON public.library_settings;
CREATE POLICY "signed-in reads settings" ON public.library_settings
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.library_settings FROM anon;

DROP POLICY IF EXISTS "covers public read" ON storage.objects;
CREATE POLICY "covers admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'book-covers'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
DROP POLICY IF EXISTS "signed-in reads settings" ON public.library_settings;
CREATE POLICY "admins read settings" ON public.library_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
REVOKE SELECT ON public.library_settings FROM anon;

DROP POLICY IF EXISTS "anyone reads books" ON public.books;
CREATE POLICY "public reads active books" ON public.books
  FOR SELECT TO anon, authenticated
  USING (is_archived = false);
CREATE POLICY "admins read all books" ON public.books
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "students read archived books from own history" ON public.books
  FOR SELECT TO authenticated
  USING (
    is_archived = true
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.book_id = books.id AND l.student_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.borrow_requests r
        WHERE r.book_id = books.id AND r.student_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "anyone reads categories" ON public.categories;
CREATE POLICY "public reads categories with active books" ON public.categories
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.books b
      WHERE b.category_id = categories.id AND b.is_archived = false
    )
  );
CREATE POLICY "students read categories from own history" ON public.categories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.books b
      WHERE b.category_id = categories.id
        AND b.is_archived = true
        AND (
          EXISTS (
            SELECT 1 FROM public.loans l
            WHERE l.book_id = b.id AND l.student_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.borrow_requests r
            WHERE r.book_id = b.id AND r.student_id = auth.uid()
          )
        )
    )
  );
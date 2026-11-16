CREATE OR REPLACE FUNCTION public.request_book(_book_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b public.books; s public.library_settings; st text; cnt int; rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in to request books'; END IF;
  SELECT account_status INTO st FROM public.profiles WHERE id = uid;
  IF st <> 'active' THEN RAISE EXCEPTION 'Your account is suspended. Please contact the library.'; END IF;
  SELECT * INTO s FROM public.library_settings WHERE id = 1;
  SELECT * INTO b FROM public.books WHERE id = _book_id;
  IF b.id IS NULL OR b.is_archived THEN RAISE EXCEPTION 'Book not found'; END IF;
  IF b.available_copies <= 0 THEN RAISE EXCEPTION 'All copies are currently borrowed'; END IF;
  IF EXISTS (SELECT 1 FROM public.borrow_requests WHERE student_id = uid AND book_id = _book_id AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending request for this book';
  END IF;
  IF EXISTS (SELECT 1 FROM public.loans WHERE student_id = uid AND book_id = _book_id AND status = 'active') THEN
    RAISE EXCEPTION 'You already have this book on loan';
  END IF;
  SELECT (SELECT count(*) FROM public.loans WHERE student_id = uid AND status = 'active')
       + (SELECT count(*) FROM public.borrow_requests WHERE student_id = uid AND status = 'pending') INTO cnt;
  IF cnt >= s.max_books_per_student THEN
    RAISE EXCEPTION 'Borrowing limit reached. Please return a book or contact the library.';
  END IF;
  INSERT INTO public.borrow_requests (student_id, book_id) VALUES (uid, _book_id) RETURNING id INTO rid;
  PERFORM public.notify(uid, 'Request submitted', format('Your request for "%s" is awaiting approval.', b.title));
  RETURN rid;
END $$;
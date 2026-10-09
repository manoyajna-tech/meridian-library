
-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  student_id text UNIQUE,
  department text,
  account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own or admin read profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own or admin update profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own or admin read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.email IS DISTINCT FROM OLD.email OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.account_status IS DISTINCT FROM OLD.account_status OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'You can only update your name and department';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_profile BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, student_id, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'student_id', ''),
    NULLIF(NEW.raw_user_meta_data->>'department', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM pg_advisory_xact_lock(424242);
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'An administrator already exists';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.set_user_admin(_user_id uuid, _make_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove your own admin role'; END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
  END IF;
END $$;

-- ===== Catalog =====
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn text NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  author text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  publisher text,
  publication_year int CHECK (publication_year BETWEEN 1000 AND 2100),
  description text,
  cover_image_url text,
  total_copies int NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  available_copies int NOT NULL DEFAULT 1,
  shelf_location text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT available_range CHECK (available_copies >= 0 AND available_copies <= total_copies)
);
CREATE INDEX books_category_idx ON public.books(category_id);
CREATE INDEX books_title_idx ON public.books(lower(title));

CREATE OR REPLACE FUNCTION public.books_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.available_copies := NEW.total_copies;
  ELSIF NEW.total_copies <> OLD.total_copies AND NEW.available_copies = OLD.available_copies THEN
    NEW.available_copies := OLD.available_copies + (NEW.total_copies - OLD.total_copies);
    IF NEW.available_copies < 0 THEN
      RAISE EXCEPTION 'Total copies cannot be lower than the number of copies currently on loan';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_books_before_write BEFORE INSERT OR UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.books_before_write();

GRANT SELECT ON public.categories, public.books TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories, public.books TO authenticated;
GRANT ALL ON public.categories, public.books TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin writes categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "anyone reads books" ON public.books FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin inserts books" ON public.books FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates books" ON public.books FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== Settings =====
CREATE TABLE public.library_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  borrowing_period_days int NOT NULL DEFAULT 14 CHECK (borrowing_period_days BETWEEN 1 AND 365),
  max_books_per_student int NOT NULL DEFAULT 3 CHECK (max_books_per_student BETWEEN 1 AND 50),
  fine_per_day numeric(10,2) NOT NULL DEFAULT 5 CHECK (fine_per_day >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.library_settings (id) VALUES (1);
GRANT SELECT ON public.library_settings TO anon;
GRANT SELECT, UPDATE ON public.library_settings TO authenticated;
GRANT ALL ON public.library_settings TO service_role;
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads settings" ON public.library_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin updates settings" ON public.library_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== Circulation =====
CREATE TABLE public.borrow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  note text
);
CREATE UNIQUE INDEX one_pending_request ON public.borrow_requests(student_id, book_id) WHERE status = 'pending';
CREATE INDEX borrow_requests_status_idx ON public.borrow_requests(status);

CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  request_id uuid REFERENCES public.borrow_requests(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL,
  return_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned')),
  fine_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
  fine_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_date >= issue_date)
);
CREATE UNIQUE INDEX one_active_loan ON public.loans(student_id, book_id) WHERE status = 'active';
CREATE INDEX loans_status_idx ON public.loans(status, due_date);
CREATE INDEX loans_student_idx ON public.loans(student_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  kind text,
  loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_reminder_per_loan ON public.notifications(loan_id, kind) WHERE loan_id IS NOT NULL AND kind IN ('due_soon','overdue');
CREATE INDEX notifications_user_idx ON public.notifications(user_id, is_read);

GRANT SELECT ON public.borrow_requests, public.loans TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.borrow_requests, public.loans, public.notifications TO service_role;
ALTER TABLE public.borrow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read requests" ON public.borrow_requests FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own or admin read loans" ON public.loans FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_notification_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.title <> OLD.title OR NEW.message <> OLD.message OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Only the read status can be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_notification BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_notification_update();

CREATE OR REPLACE FUNCTION public.notify(_user uuid, _title text, _msg text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, title, message) VALUES (_user, _title, _msg);
$$;
REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.calc_fine(_due date, _on date, _rate numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT round(GREATEST(0, (_on - _due))::numeric * _rate, 2)
$$;

CREATE OR REPLACE FUNCTION public._issue(_student uuid, _book uuid, _request uuid, _admin uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.books; s public.library_settings; st text; active_count int; new_id uuid;
BEGIN
  SELECT * INTO s FROM public.library_settings WHERE id = 1;
  SELECT account_status INTO st FROM public.profiles WHERE id = _student;
  IF st IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF st <> 'active' THEN RAISE EXCEPTION 'This student account is suspended'; END IF;
  SELECT * INTO b FROM public.books WHERE id = _book FOR UPDATE;
  IF b.id IS NULL OR b.is_archived THEN RAISE EXCEPTION 'Book not available'; END IF;
  IF b.available_copies <= 0 THEN RAISE EXCEPTION 'No copies of "%" are available', b.title; END IF;
  IF EXISTS (SELECT 1 FROM public.loans WHERE student_id = _student AND book_id = _book AND status = 'active') THEN
    RAISE EXCEPTION 'Student already has this book on loan';
  END IF;
  SELECT count(*) INTO active_count FROM public.loans WHERE student_id = _student AND status = 'active';
  IF active_count >= s.max_books_per_student THEN
    RAISE EXCEPTION 'Borrowing limit reached (% books)', s.max_books_per_student;
  END IF;
  UPDATE public.books SET available_copies = available_copies - 1 WHERE id = _book;
  INSERT INTO public.loans (student_id, book_id, request_id, issued_by, issue_date, due_date)
  VALUES (_student, _book, _request, _admin, current_date, current_date + s.borrowing_period_days)
  RETURNING id INTO new_id;
  PERFORM public.notify(_student, 'Book issued', format('"%s" has been issued to you. Due on %s.', b.title, to_char(current_date + s.borrowing_period_days, 'DD Mon YYYY')));
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public._issue(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

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
    RAISE EXCEPTION 'Borrowing limit reached: you can have up to % books (loans + pending requests)', s.max_books_per_student;
  END IF;
  INSERT INTO public.borrow_requests (student_id, book_id) VALUES (uid, _book_id) RETURNING id INTO rid;
  PERFORM public.notify(uid, 'Request submitted', format('Your request for "%s" is awaiting approval.', b.title));
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.borrow_requests SET status = 'cancelled', reviewed_at = now()
  WHERE id = _request_id AND student_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already processed'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.approve_request(_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.borrow_requests; lid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO r FROM public.borrow_requests WHERE id = _request_id FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  lid := public._issue(r.student_id, r.book_id, r.id, auth.uid());
  UPDATE public.borrow_requests SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() WHERE id = r.id;
  PERFORM public.notify(r.student_id, 'Request approved', (SELECT format('Your request for "%s" was approved.', title) FROM public.books WHERE id = r.book_id));
  RETURN lid;
END $$;

CREATE OR REPLACE FUNCTION public.reject_request(_request_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.borrow_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.borrow_requests SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), note = _note
  WHERE id = _request_id AND status = 'pending' RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request is not pending'; END IF;
  PERFORM public.notify(r.student_id, 'Request rejected',
    (SELECT format('Your request for "%s" was rejected.%s', title, COALESCE(' Reason: ' || _note, '')) FROM public.books WHERE id = r.book_id));
END $$;

CREATE OR REPLACE FUNCTION public.issue_book(_student_id uuid, _book_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN public._issue(_student_id, _book_id, NULL, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.return_loan(_loan_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.loans; rate numeric; fine numeric; t text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO l FROM public.loans WHERE id = _loan_id FOR UPDATE;
  IF l.id IS NULL OR l.status <> 'active' THEN RAISE EXCEPTION 'Loan is not active'; END IF;
  SELECT fine_per_day INTO rate FROM public.library_settings WHERE id = 1;
  fine := public.calc_fine(l.due_date, current_date, rate);
  UPDATE public.loans SET status = 'returned', return_date = current_date, fine_amount = fine, fine_paid = (fine = 0) WHERE id = l.id;
  UPDATE public.books SET available_copies = available_copies + 1 WHERE id = l.book_id RETURNING title INTO t;
  PERFORM public.notify(l.student_id, 'Book returned',
    format('"%s" was returned.%s', t, CASE WHEN fine > 0 THEN format(' A late fine of ₹%s applies.', fine) ELSE '' END));
  RETURN fine;
END $$;

CREATE OR REPLACE FUNCTION public.mark_fine_paid(_loan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.loans SET fine_paid = true WHERE id = _loan_id AND status = 'returned';
END $$;

CREATE OR REPLACE FUNCTION public.delete_or_archive_book(_book_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF EXISTS (SELECT 1 FROM public.loans WHERE book_id = _book_id AND status = 'active') THEN
    RAISE EXCEPTION 'This book has active loans. Record the returns first, or archive it.';
  END IF;
  UPDATE public.borrow_requests SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), note = 'Book withdrawn'
  WHERE book_id = _book_id AND status = 'pending';
  IF EXISTS (SELECT 1 FROM public.loans WHERE book_id = _book_id) OR EXISTS (SELECT 1 FROM public.borrow_requests WHERE book_id = _book_id) THEN
    UPDATE public.books SET is_archived = true WHERE id = _book_id;
    RETURN 'archived';
  END IF;
  DELETE FROM public.books WHERE id = _book_id;
  RETURN 'deleted';
END $$;

CREATE OR REPLACE FUNCTION public.set_student_status(_user_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own status'; END IF;
  UPDATE public.profiles SET account_status = _status WHERE id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.generate_due_reminders()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n1 int; n2 int;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, kind, loan_id)
  SELECT l.student_id, 'Due soon', format('"%s" is due on %s.', b.title, to_char(l.due_date, 'DD Mon YYYY')), 'due_soon', l.id
  FROM public.loans l JOIN public.books b ON b.id = l.book_id
  WHERE l.status = 'active' AND l.due_date BETWEEN current_date AND current_date + 2
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n1 = ROW_COUNT;
  INSERT INTO public.notifications (user_id, title, message, kind, loan_id)
  SELECT l.student_id, 'Overdue', format('"%s" was due on %s. Please return it to avoid further fines.', b.title, to_char(l.due_date, 'DD Mon YYYY')), 'overdue', l.id
  FROM public.loans l JOIN public.books b ON b.id = l.book_id
  WHERE l.status = 'active' AND l.due_date < current_date
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n2 = ROW_COUNT;
  RETURN n1 + n2;
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_due_reminders() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'total_books', COALESCE((SELECT sum(total_copies) FROM public.books WHERE NOT is_archived), 0),
    'titles', (SELECT count(*) FROM public.books WHERE NOT is_archived),
    'available_books', COALESCE((SELECT sum(available_copies) FROM public.books WHERE NOT is_archived), 0),
    'members', (SELECT count(*) FROM public.profiles)
  )
$$;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;

CREATE POLICY "covers public read" ON storage.objects FOR SELECT USING (bucket_id = 'book-covers');
CREATE POLICY "covers admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "covers admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "covers admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'));

INSERT INTO public.categories (name, description) VALUES
 ('Programming', 'Software craftsmanship, languages and practices'),
 ('Computer Science', 'Algorithms, systems, networks and AI'),
 ('Mathematics', 'Calculus, algebra and proofs'),
 ('Science', 'Physics, biology and the natural world'),
 ('Literature', 'Classic and modern fiction'),
 ('General Knowledge', 'History, society and big ideas');

INSERT INTO public.books (isbn, title, author, category_id, publisher, publication_year, description, cover_image_url, total_copies, shelf_location)
SELECT v.isbn, v.title, v.author, c.id, v.publisher, v.yr, v.descr, 'https://covers.openlibrary.org/b/isbn/' || v.isbn || '-L.jpg', v.copies, v.shelf
FROM (VALUES
 ('9780132350884','Clean Code','Robert C. Martin','Programming','Prentice Hall',2008,'A handbook of agile software craftsmanship: how to write code that is readable, maintainable and robust.',4,'A1-01'),
 ('9780135957059','The Pragmatic Programmer','David Thomas, Andrew Hunt','Programming','Addison-Wesley',2019,'Timeless lessons for building better software and a more fulfilling career.',3,'A1-02'),
 ('9780201633610','Design Patterns','Erich Gamma et al.','Programming','Addison-Wesley',1994,'The classic catalogue of reusable object-oriented design patterns.',2,'A1-03'),
 ('9781593279509','Eloquent JavaScript','Marijn Haverbeke','Programming','No Starch Press',2018,'A modern introduction to programming with JavaScript.',3,'A1-04'),
 ('9780262033848','Introduction to Algorithms','Thomas H. Cormen et al.','Computer Science','MIT Press',2009,'The comprehensive reference on algorithms and data structures.',5,'B2-01'),
 ('9780262510875','Structure and Interpretation of Computer Programs','Harold Abelson, Gerald Jay Sussman','Computer Science','MIT Press',1996,'Foundational text on abstraction, recursion and interpreters.',2,'B2-02'),
 ('9780133594140','Computer Networking: A Top-Down Approach','James Kurose, Keith Ross','Computer Science','Pearson',2016,'Networking principles from applications down to the physical layer.',3,'B2-03'),
 ('9781118063330','Operating System Concepts','Abraham Silberschatz et al.','Computer Science','Wiley',2012,'Processes, memory, storage and the design of modern operating systems.',3,'B2-04'),
 ('9780136042594','Artificial Intelligence: A Modern Approach','Stuart Russell, Peter Norvig','Computer Science','Pearson',2009,'The leading textbook on artificial intelligence.',2,'B2-05'),
 ('9781285740621','Calculus: Early Transcendentals','James Stewart','Mathematics','Cengage',2015,'Clear, rigorous introduction to single and multivariable calculus.',4,'C3-01'),
 ('9780321982384','Linear Algebra and Its Applications','David C. Lay','Mathematics','Pearson',2015,'Linear algebra concepts with applications across science and engineering.',3,'C3-02'),
 ('9780521675994','How to Prove It','Daniel J. Velleman','Mathematics','Cambridge University Press',2006,'A structured approach to writing mathematical proofs.',2,'C3-03'),
 ('9780553380163','A Brief History of Time','Stephen Hawking','Science','Bantam',1998,'From the Big Bang to black holes, explained for everyone.',3,'D4-01'),
 ('9780198788607','The Selfish Gene','Richard Dawkins','Science','Oxford University Press',2016,'A gene-centred view of evolution.',2,'D4-02'),
 ('9780345539434','Cosmos','Carl Sagan','Science','Ballantine Books',2013,'A journey through the universe and our place in it.',2,'D4-03'),
 ('9780061120084','To Kill a Mockingbird','Harper Lee','Literature','Harper Perennial',2006,'A story of justice and growing up in the American South.',3,'E5-01'),
 ('9780451524935','1984','George Orwell','Literature','Signet Classic',1961,'A chilling vision of a surveillance state.',4,'E5-02'),
 ('9780141439518','Pride and Prejudice','Jane Austen','Literature','Penguin Classics',2002,'Austen''s beloved novel of manners and marriage.',2,'E5-03'),
 ('9780062316097','Sapiens','Yuval Noah Harari','General Knowledge','Harper',2015,'A brief history of humankind.',3,'F6-01'),
 ('9780393354324','Guns, Germs, and Steel','Jared Diamond','General Knowledge','W. W. Norton',2017,'Why history unfolded differently on different continents.',2,'F6-02')
) AS v(isbn,title,author,cat,publisher,yr,descr,copies,shelf)
JOIN public.categories c ON c.name = v.cat;

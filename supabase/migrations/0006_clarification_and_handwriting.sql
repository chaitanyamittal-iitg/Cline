-- SAFAL schema 6: clarification answers and student-confirmed handwriting (fix/learning-contracts milestone).
-- Apply AFTER 0001-0005, once, in Supabase > SQL Editor. Do not re-run 0001-0005.
-- Adds columns to the existing public.answers table only. No new table, so no new GRANT or policy is needed:
-- the table-level grants and the "answers: own or teacher" policy from 0004 already cover the new columns
-- (authenticated can still only SELECT; only the server writes them).

-- A follow-up reply is stored as a second answer row that points at the original, so the original student work is
-- never overwritten and the teacher can see both.
alter table public.answers
  add column kind text not null default 'original' check (kind in ('original', 'clarification')),
  add column clarifies_answer_id uuid references public.answers (id) on delete cascade,
  add column confirmed_text text,
  add column reading_status text check (reading_status in ('read', 'unclear', 'not_read'));

-- A clarification row must name the answer it clarifies; an original must not.
alter table public.answers
  add constraint answers_clarification_link
  check ((kind = 'clarification') = (clarifies_answer_id is not null));

-- Handwritten work is only diagnosed from text the STUDENT confirmed or corrected. NOT VALID: enforced for new rows
-- without re-checking rows that existed before this migration.
alter table public.answers
  add constraint answers_upload_needs_confirmed_text
  check (upload_path is null or confirmed_text is not null) not valid;

-- Each question has one original answer per attempt, and at most one clarification per original answer.
create unique index answers_one_original_uq
  on public.answers (attempt_id, question_id) where kind = 'original';
create unique index answers_one_clarification_uq
  on public.answers (clarifies_answer_id) where clarifies_answer_id is not null;

-- Ask the Data API to pick up the new columns straight away.
notify pgrst, 'reload schema';

-- SAFAL schema 5: two fixes found while defining ownership and API contracts, before any feature code
-- depends on them. Apply AFTER 0001-0004 (see docs/TASKS.md, "Applying migration 0005").
-- Same rules as before: Data API on, automatic exposure OFF, so every table needs explicit GRANTs + RLS.

-- Fix 1: homework answers live in homework_responses, not in answers, but diagnoses.answer_id was NOT NULL,
-- so a homework answer could never be diagnosed and stored. Homework diagnoses are linked from
-- homework_responses.diagnosis_id instead, so answer_id must be allowed to be empty.
alter table public.diagnoses alter column answer_id drop not null;

-- Fix 2: AI-generated questions (reassessments and homework) need a hidden "expected idea" so the answer can be
-- diagnosed. attempts.questions and homework.items are readable by students, so the key must live in its own
-- table that only the teacher can read, exactly like question_keys does for the predefined test.
create table public.generated_question_keys (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references public.attempts (id) on delete cascade,
  homework_id uuid references public.homework (id) on delete cascade,
  question_id text not null,
  expected_idea text not null,
  created_at timestamptz not null default now(),
  check ((attempt_id is null) <> (homework_id is null))   -- belongs to exactly one of the two
);

create unique index generated_question_keys_attempt_uq
  on public.generated_question_keys (attempt_id, question_id) where attempt_id is not null;
create unique index generated_question_keys_homework_uq
  on public.generated_question_keys (homework_id, question_id) where homework_id is not null;

alter table public.generated_question_keys enable row level security;

create policy "generated_question_keys: teacher only" on public.generated_question_keys
  for select to authenticated using (public.is_teacher());

-- Grants: students get the grant but RLS returns them zero rows (same pattern as question_keys).
-- The server writes keys when it generates questions; rows disappear with their attempt/homework (cascade).
revoke all on public.generated_question_keys from anon, authenticated, service_role;
grant select on public.generated_question_keys to authenticated;
grant select, insert on public.generated_question_keys to service_role;

-- Ask the Data API to pick up the changes straight away.
notify pgrst, 'reload schema';

-- SAFAL schema 4/4: row-level security, explicit least-privilege GRANTs, and the private upload bucket.
--
-- Project setting assumed: Data API ON, "automatic table exposure" OFF, "automatic RLS" ON.
-- That means NEW TABLES HAVE NO API ACCESS until we GRANT it. Two layers protect every table:
--   1. GRANT  = which roles may run which statements on the table at all (this file, bottom).
--   2. RLS    = which ROWS those roles may touch (policies, below).
-- Roles: anon = logged-out visitor (gets nothing), authenticated = logged-in user,
--        service_role = our server only (the key is never sent to a browser).
-- No INSERT/UPDATE policies exist on learning-state tables on purpose: only the server
-- (service-role key) writes them, after checking the logged-in user.

alter table public.profiles           enable row level security;
alter table public.concepts           enable row level security;
alter table public.resources          enable row level security;
alter table public.questions          enable row level security;
alter table public.question_keys      enable row level security;
alter table public.concept_progress   enable row level security;
alter table public.attempts           enable row level security;
alter table public.answers            enable row level security;
alter table public.diagnoses          enable row level security;
alter table public.support_cycles     enable row level security;
alter table public.tutor_messages     enable row level security;
alter table public.homework           enable row level security;
alter table public.homework_responses enable row level security;
alter table public.teacher_actions    enable row level security;

create policy "profiles: own or teacher" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_teacher());

create policy "concepts: read" on public.concepts
  for select to authenticated using (true);
create policy "questions: read" on public.questions
  for select to authenticated using (true);
create policy "resources: approved or teacher" on public.resources
  for select to authenticated using (approved or public.is_teacher());
create policy "question_keys: teacher only" on public.question_keys
  for select to authenticated using (public.is_teacher());

create policy "concept_progress: own or teacher" on public.concept_progress
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "attempts: own or teacher" on public.attempts
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "answers: own or teacher" on public.answers
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "diagnoses: own or teacher" on public.diagnoses
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "support_cycles: own or teacher" on public.support_cycles
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "tutor_messages: own or teacher" on public.tutor_messages
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "homework: own or teacher" on public.homework
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "homework_responses: own or teacher" on public.homework_responses
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());

-- teacher_actions is an append-only log: the teacher may read and add rows, never edit or delete them.
create policy "teacher_actions: teacher or the student concerned reads" on public.teacher_actions
  for select to authenticated using (public.is_teacher() or student_id = auth.uid());
create policy "teacher_actions: teacher adds" on public.teacher_actions
  for insert to authenticated
  with check (public.is_teacher() and teacher_id = auth.uid());

-- Private bucket for handwritten uploads. Files are stored as "<student_uuid>/<file>".
insert into storage.buckets (id, name, public)
values ('student-work', 'student-work', false)
on conflict (id) do nothing;

create policy "student-work: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'student-work' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "student-work: read own, teacher reads all" on storage.objects
  for select to authenticated
  using (bucket_id = 'student-work'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher()));

-- ======================================================================================
-- EXPLICIT GRANTS (least privilege). Safe to re-run: we revoke first, then grant exactly what is listed.
-- ======================================================================================

-- Start from zero for the two API roles that browsers can reach, so nothing is left over.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from service_role;

-- Make tables created LATER also start with no API access (belt and braces next to the project setting).
alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;

-- Schema access. anon gets none: a logged-out visitor can use nothing in the public schema.
revoke usage on schema public from anon;
grant usage on schema public to authenticated, service_role;

-- The RLS policies call is_teacher(), so the roles that evaluate them need EXECUTE. Nobody else does.
revoke execute on function public.is_teacher() from public, anon;
grant execute on function public.is_teacher() to authenticated, service_role;

-- ---- authenticated (logged-in student or teacher): READ ONLY, rows limited by the RLS policies above.
grant select on
  public.profiles,
  public.concepts,
  public.questions,
  public.resources,
  public.question_keys,        -- RLS lets only the teacher see rows; students get zero rows
  public.concept_progress,
  public.attempts,
  public.answers,
  public.diagnoses,
  public.support_cycles,
  public.tutor_messages,
  public.homework,
  public.homework_responses,
  public.teacher_actions
to authenticated;

-- The one thing a logged-in user may write directly: a teacher adding to the audit log (RLS enforces "teacher").
grant insert on public.teacher_actions to authenticated;

-- ---- service_role (our SERVER only): just what the app and seed script need.
-- Reference content is read-only for the app; content changes are made by running the seed SQL as admin.
grant select on
  public.concepts,
  public.questions,
  public.question_keys,
  public.resources
to service_role;

-- Profiles are created by the user seed script; the app never deletes them.
grant select, insert, update on public.profiles to service_role;

-- Learning state: written by server code after it has checked who is logged in.
grant select, insert, update, delete on
  public.concept_progress,
  public.attempts,
  public.answers,
  public.diagnoses,
  public.support_cycles,
  public.tutor_messages,
  public.homework,
  public.homework_responses
to service_role;

-- teacher_actions is append-only for the app; delete exists only so the demo reset can clear a student's log.
grant select, insert, delete on public.teacher_actions to service_role;

-- Not granted on purpose: anon on anything; authenticated INSERT/UPDATE/DELETE on learning state;
-- TRUNCATE, REFERENCES and TRIGGER for every API role. There are no sequences (ids are uuids).

-- SAFAL schema 3/4: personalised homework and teacher actions.

create table public.homework (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  for_date date not null default current_date,
  items jsonb not null,                -- [{id, concept_id, prompt}]
  ai_source text not null check (ai_source in ('mock', 'live')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, for_date)
);

create table public.homework_responses (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homework (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null,
  typed_text text,
  upload_path text,
  interpreted_text text,
  is_correct boolean,
  diagnosis_id uuid references public.diagnoses (id) on delete set null,
  created_at timestamptz not null default now(),
  check (typed_text is not null or upload_path is not null)
);

create table public.teacher_actions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  concept_id text not null references public.concepts (id) on delete cascade,
  action text not null check (action in (
    'approve_next_concept', 'override_diagnosis', 'assign_support', 'clear_flag', 'note')),
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- SAFAL schema 2/4: learning state, answers, diagnoses, support cycles, tutor chat.

create table public.concept_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  concept_id text not null references public.concepts (id) on delete cascade,
  state text not null default 'lesson' check (state in (
    'lesson', 'doubts', 'microtest', 'analysis',
    'support', 'reassessment', 'passed', 'teacher_flagged')),
  support_cycles_used int not null default 0 check (support_cycles_used between 0 and 2),
  teacher_flagged boolean not null default false,
  teacher_cleared_to_next boolean not null default false,  -- only the teacher sets this
  updated_at timestamptz not null default now(),
  unique (student_id, concept_id)
);

-- One attempt = one sitting of the micro-test or of a reassessment.
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  concept_id text not null references public.concepts (id) on delete cascade,
  kind text not null check (kind in ('microtest', 'reassessment')),
  cycle int not null default 0 check (cycle between 0 and 2),  -- 0 = first predefined test
  questions jsonb not null default '[]'::jsonb,                -- [{id, prompt}] incl. generated ones
  ai_source text check (ai_source in ('mock', 'live')),         -- null for the predefined test
  created_at timestamptz not null default now()
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null,
  typed_text text,
  upload_path text,                    -- path inside private bucket 'student-work'
  interpreted_text text,               -- AI reading of the handwritten image
  interpreted_by text check (interpreted_by in ('mock', 'live')),
  is_correct boolean,                  -- right/wrong only. No numerical score anywhere.
  created_at timestamptz not null default now(),
  check (typed_text is not null or upload_path is not null)
);

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  concept_id text not null references public.concepts (id) on delete cascade,
  is_correct boolean not null,
  reasoning_sound boolean not null,    -- false covers "right answer, faulty reasoning"
  misconception text,
  evidence text not null,
  next_action text not null check (next_action in ('follow_up_question', 'targeted_support', 'none')),
  follow_up_question text,
  ai_source text not null check (ai_source in ('mock', 'live')),
  created_at timestamptz not null default now()
);

create table public.support_cycles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  concept_id text not null references public.concepts (id) on delete cascade,
  cycle_number int not null check (cycle_number in (1, 2)),   -- hard cap: two cycles
  diagnosis_id uuid references public.diagnoses (id) on delete set null,
  support jsonb not null,              -- explanation, guiding question, practice, resource ids
  reassessment_attempt_id uuid references public.attempts (id) on delete set null,
  outcome text not null default 'pending' check (outcome in ('pending', 'succeeded', 'struggled')),
  ai_source text not null check (ai_source in ('mock', 'live')),
  created_at timestamptz not null default now(),
  unique (student_id, concept_id, cycle_number)
);

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  concept_id text not null references public.concepts (id) on delete cascade,
  role text not null check (role in ('student', 'tutor')),
  content text not null,
  resource_id text references public.resources (id) on delete set null,
  ai_source text check (ai_source in ('mock', 'live')),         -- set on tutor messages
  created_at timestamptz not null default now()
);

create index on public.answers (student_id, created_at desc);
create index on public.diagnoses (student_id, concept_id, created_at desc);
create index on public.tutor_messages (student_id, concept_id, created_at);
create index on public.attempts (student_id, concept_id, created_at);

-- SAFAL schema 1/4: profiles and teacher-approved content.
-- Lead-owned file. Run the four files in order in Supabase Dashboard > SQL Editor.
-- Rules:
--   * Students read only their own rows. The teacher reads the whole (fictional) class.
--   * Learning-state writes (progress, diagnoses, support cycles) are made by the SERVER
--     with the service-role key. Students never write them directly.
--   * Answer keys live in a table students cannot read.

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'teacher')),
  display_name text not null,
  class_label text not null default 'Class 7 (demo)',
  created_at timestamptz not null default now()
);

-- Used by policies. SECURITY DEFINER so it can read profiles without policy recursion.
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher');
$$;

create table public.concepts (
  id text primary key,                 -- 'C1'..'C4'
  position int not null unique,
  title text not null,
  objective text not null
);

-- Teacher-approved material only. The tutor may use rows where approved = true.
create table public.resources (
  id text primary key,
  concept_id text not null references public.concepts (id) on delete cascade,
  kind text not null check (kind in ('lecture_video', 'reading', 'diagram', 'graphic', 'video')),
  title text not null,
  url text,                            -- video URL or image path under /public
  body text,                           -- reading text or diagram description (used by the tutor)
  approved boolean not null default false,
  position int not null default 0
);

-- What students see: the question text only.
create table public.questions (
  id text primary key,
  concept_id text not null references public.concepts (id) on delete cascade,
  prompt text not null,
  position int not null,
  unique (concept_id, position)
);

-- Hidden from students: what a good answer must show.
create table public.question_keys (
  question_id text primary key references public.questions (id) on delete cascade,
  expected_idea text not null,
  common_misconceptions text[] not null default '{}'
);

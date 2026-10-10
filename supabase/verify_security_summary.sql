-- ONE READ-ONLY QUERY. Run it in Supabase > SQL Editor. Changes nothing.
-- It is the pass/fail version of the six listings in verify_security.sql.
--
-- Run it AFTER all five migrations (0001 to 0005). If only 0001-0004 are applied, checks 1, 8 and 14 will say
-- FAIL on purpose (they count the tables and policies that 0005 adds); that means "apply 0005", not "broken".
-- History: run once by the lead after migration 0005 (14 of 14 PASS, user-reported, 10 Oct 2026). Re-run it after
-- any new migration; treat any row that does not say PASS as unverified.
--
-- EXPECTED RESULT: 14 rows, and the "result" column says PASS on every row.
-- If any row says FAIL, send the lead that row's check_name (no keys needed) and do not continue.

with
tbl as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
privs as (
  select unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p
),
checks as (
  select 1 as n, 'public schema has exactly the 15 SAFAL tables, all with RLS enabled' as check_name,
         (select count(*) from tbl) = 15 and (select count(*) from tbl where relrowsecurity) = 15 as ok
  union all
  select 2, 'anon (logged out) has no privilege on any public table',
         not exists (select 1 from tbl cross join privs where has_table_privilege('anon', tbl.oid, privs.p))
  union all
  select 3, 'authenticated can SELECT every public table (RLS limits the rows)',
         not exists (select 1 from tbl where not has_table_privilege('authenticated', tbl.oid, 'select'))
  union all
  select 4, 'authenticated has no write privilege except INSERT on teacher_actions',
         not exists (
           select 1 from tbl cross join privs
           where privs.p <> 'select'
             and has_table_privilege('authenticated', tbl.oid, privs.p)
             and not (privs.p = 'insert' and tbl.relname = 'teacher_actions'))
  union all
  select 5, 'service_role has no TRUNCATE, REFERENCES or TRIGGER privilege',
         not exists (
           select 1 from tbl cross join privs
           where privs.p in ('truncate', 'references', 'trigger')
             and has_table_privilege('service_role', tbl.oid, privs.p))
  union all
  select 6, 'service_role has full read/write on the 8 learning-state tables',
         not exists (
           select 1 from tbl cross join privs
           where tbl.relname in ('concept_progress', 'attempts', 'answers', 'diagnoses',
                                 'support_cycles', 'tutor_messages', 'homework', 'homework_responses')
             and privs.p in ('select', 'insert', 'update', 'delete')
             and not has_table_privilege('service_role', tbl.oid, privs.p))
  union all
  select 7, 'service_role cannot modify reference content (concepts, questions, question_keys, resources)',
         not exists (
           select 1 from tbl cross join privs
           where tbl.relname in ('concepts', 'questions', 'question_keys', 'resources')
             and privs.p in ('insert', 'update', 'delete')
             and has_table_privilege('service_role', tbl.oid, privs.p))
  union all
  select 8, 'exactly 16 public policies, all for authenticated only, none for UPDATE/DELETE/ALL',
         (select count(*) from pg_policies where schemaname = 'public') = 16
         and not exists (
           select 1 from pg_policies
           where schemaname = 'public'
             and (cmd in ('UPDATE', 'DELETE', 'ALL') or roles <> '{authenticated}'))
  union all
  select 9, 'storage bucket student-work exists and is private',
         exists (select 1 from storage.buckets where id = 'student-work' and public = false)
  union all
  select 10, 'storage.objects has exactly the 2 student-work policies',
         (select count(*) from pg_policies
          where schemaname = 'storage' and tablename = 'objects' and policyname like 'student-work:%') = 2
  union all
  select 11, 'is_teacher() is executable by authenticated and service_role, not by anon',
         has_function_privilege('authenticated', 'public.is_teacher()', 'execute')
         and has_function_privilege('service_role', 'public.is_teacher()', 'execute')
         and not has_function_privilege('anon', 'public.is_teacher()', 'execute')
  union all
  select 12, 'question_keys has exactly one policy and it requires is_teacher()',
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'question_keys') = 1
         and exists (select 1 from pg_policies
                     where schemaname = 'public' and tablename = 'question_keys' and qual like '%is_teacher()%')
  union all
  select 13, 'teacher_actions INSERT policy requires is_teacher() and teacher_id = own id',
         exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'teacher_actions' and cmd = 'INSERT'
                   and with_check like '%is_teacher()%' and with_check like '%teacher_id%')
  union all
  select 14, 'migration 0005 applied: diagnoses.answer_id allows NULL; generated_question_keys is teacher-only',
         exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'diagnoses'
                   and column_name = 'answer_id' and is_nullable = 'YES')
         and (select count(*) from pg_policies
              where schemaname = 'public' and tablename = 'generated_question_keys') = 1
         and exists (select 1 from pg_policies
                     where schemaname = 'public' and tablename = 'generated_question_keys'
                       and qual like '%is_teacher()%')
)
select check_name, case when coalesce(ok, false) then 'PASS' else 'FAIL' end as result
from checks
order by n;

-- ONE READ-ONLY QUERY. Run it in Supabase > SQL Editor AFTER applying 0006_clarification_and_handwriting.sql.
-- It changes nothing.
--
-- EXPECTED RESULT: 7 rows, and the "result" column says PASS on every row.
-- If any row says FAIL, send the lead that row's check_name (no keys needed).
-- It is separate from verify_security_summary.sql on purpose: 0006 adds columns, not tables or policies, so that
-- query's counts (15 tables, 16 policies, 14 checks) stay the same and must still all PASS.

with checks as (
  select 1 as n, 'answers.kind exists, is NOT NULL, defaults to original' as check_name,
         exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'answers' and column_name = 'kind'
                   and is_nullable = 'NO' and column_default like '%original%') as ok
  union all
  select 2, 'answers.clarifies_answer_id, confirmed_text and reading_status exist',
         (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'answers'
            and column_name in ('clarifies_answer_id', 'confirmed_text', 'reading_status')) = 3
  union all
  select 3, 'clarification link constraint exists',
         exists (select 1 from pg_constraint where conname = 'answers_clarification_link'
                   and conrelid = 'public.answers'::regclass)
  union all
  select 4, 'handwriting needs confirmed text constraint exists',
         exists (select 1 from pg_constraint where conname = 'answers_upload_needs_confirmed_text'
                   and conrelid = 'public.answers'::regclass)
  union all
  select 5, 'one original answer per attempt and question (unique index)',
         exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'answers_one_original_uq')
  union all
  select 6, 'at most one clarification per answer (unique index)',
         exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'answers_one_clarification_uq')
  union all
  select 7, 'access unchanged: anon has no privilege on answers; authenticated can only SELECT it',
         not (has_table_privilege('anon', 'public.answers', 'select')
              or has_table_privilege('anon', 'public.answers', 'insert'))
         and has_table_privilege('authenticated', 'public.answers', 'select')
         and not (has_table_privilege('authenticated', 'public.answers', 'insert')
                  or has_table_privilege('authenticated', 'public.answers', 'update')
                  or has_table_privilege('authenticated', 'public.answers', 'delete'))
)
select check_name, case when coalesce(ok, false) then 'PASS' else 'FAIL' end as result
from checks
order by n;

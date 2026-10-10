-- ONE READ-ONLY QUERY. Run it in Supabase > SQL Editor AFTER applying 0007_learning_loop_functions.sql.
-- It changes nothing.
--
-- EXPECTED RESULT: 4 rows, and the "result" column says PASS on every row.
-- If any row says FAIL, send the lead that row's check_name (no keys needed).
-- Separate from verify_security_summary.sql on purpose: 0007 adds functions, not tables or policies, so that query's
-- counts (15 tables, 16 policies, 14 checks) stay the same and must still all PASS.

with fns(sig) as (
  values
    ('public.safal_start_microtest(uuid, text, jsonb)'),
    ('public.safal_record_answers(uuid, uuid, text, jsonb, text, boolean, text)'),
    ('public.safal_record_clarification(uuid, uuid, text, text, text, jsonb, boolean, text, boolean, text)'),
    ('public.safal_start_support(uuid, text, jsonb, uuid, text, jsonb, jsonb)'),
    ('public.safal_teacher_approve(uuid, uuid, text, text, text, boolean, boolean, boolean, text, jsonb)'),
    ('public.safal_teacher_clear_flag(uuid, uuid, text, text, jsonb)')
),
checks as (
  select 1 as n, 'all 6 learning-loop functions exist' as check_name,
         (select count(*) from fns where to_regprocedure(sig) is not null) = 6 as ok
  union all
  select 2, 'service_role can execute all 6',
         not exists (select 1 from fns where not has_function_privilege('service_role', sig, 'execute'))
  union all
  select 3, 'anon and authenticated cannot execute any of them',
         not exists (select 1 from fns
                     where has_function_privilege('anon', sig, 'execute')
                        or has_function_privilege('authenticated', sig, 'execute'))
  union all
  select 4, 'all 6 run as the caller (not security definer)',
         not exists (select 1 from fns where (select prosecdef from pg_proc where oid = to_regprocedure(sig)))
)
select check_name, case when coalesce(ok, false) then 'PASS' else 'FAIL' end as result
from checks
order by n;

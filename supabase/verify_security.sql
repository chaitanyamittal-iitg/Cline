-- READ-ONLY checks. Run in Supabase SQL Editor AFTER the four migrations. Changes nothing.
-- Paste the result of each block back to the lead if anything looks different from "Expected".

-- 1) Every public table must have row-level security ON.
-- Expected (after migration 0005): rls_enabled = true for all 15 tables.
-- Easier alternative: verify_security_summary.sql gives one PASS/FAIL row per rule instead of these listings.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 2) The logged-out role (anon) must have NO table privileges.
-- Expected: zero rows.
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';

-- 3) Logged-in users: SELECT everywhere, plus INSERT on teacher_actions only.
-- Expected: no UPDATE, DELETE or TRUNCATE rows at all.
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'authenticated'
group by table_name
order by table_name;

-- 4) The server role: narrow, listed per table.
-- Expected: content tables SELECT only; profiles SELECT/INSERT/UPDATE; the 8 learning tables
-- (concept_progress, attempts, answers, diagnoses, support_cycles, tutor_messages, homework,
-- homework_responses) full CRUD; teacher_actions SELECT/INSERT/DELETE; generated_question_keys SELECT/INSERT.
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'service_role'
group by table_name
order by table_name;

-- 5) Policies per table (names should match supabase/migrations/0004_policies_storage.sql).
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 6) Who may run is_teacher()? Expected: authenticated and service_role only (no anon, no PUBLIC).
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'is_teacher'
order by grantee;

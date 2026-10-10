# Build log (factual; for the hackathon "how Cline helped" evidence)

Only things that actually happened are recorded here. Update the "Checks" lines with real results.

REMINDER: record a short **screen recording** of Cline editing code and running checks for the mandatory demo video.

## Milestone 1: Foundation (branch `feat/foundation`)

**Date:** 10 Oct 2026

### What Cline did
- Inspected the workspace and Git state. Found: remote `origin` = `chaitanyamittal-iitg/Cline`, two commits, README stub, tech-doc PDF committed, problem-statement PDF staged. No code existed.
- Read the Tech Doc PDF (extracted text) as the product source of truth. The problem-statement PDF could only be partly extracted (headings only), so its detailed rules are unverified.
- Found Node.js and GitHub CLI missing; installed Node.js LTS 24.20.0 via `winget` (approved by the user). Node 24.20.0 and npm 11.19.0 confirmed.
- Scaffolded Next.js 16.4.0 + TypeScript into a temp folder and copied it into the repo without overwriting existing files.
- Read the bundled Next.js docs because this version renamed `middleware` to `proxy`.
- Wrote: SQL migrations (schema, RLS, private bucket), draft seed content, seed-users script, Zod contracts, `AiProvider` interface with labelled mock and live stub, Supabase clients, role guards, proxy, login page, shared layout, role-separated placeholder pages, docs.

### Problems met and how they were handled
- The IDE terminal often returned no output. Cline ran commands as detached scripts writing to log files and read the logs.
- A first `winget` run was stopped when a later command closed the terminal; it was re-run detached and succeeded.
- `npm install -D vitest` failed on an `@types/node` version conflict; fixed by moving `@types/node` to `^24`.
- PowerShell blocked `npm.ps1`; used `npm.cmd`.

### Checks (real results from the final run, 10 Oct 2026)
- `npm run lint`: passed (exit 0). The first run found 2 errors (unescaped quotes in `src/app/student/page.tsx`); fixed and re-run.
- `npm run typecheck`: passed (exit 0).
- `npm test`: passed, 7 tests in 1 file (mock AI labelling, wrong-answer diagnosis, right-answer-faulty-reasoning, support/reassessment shapes, live stub refuses to fake output, answer contract).
- `npm run build`: passed (exit 0). Routes: `/`, `/login`, `/student`, `/student/homework`, `/teacher`, plus the proxy.
- Secret check: the only `.env*` file tracked or untracked-and-not-ignored is `.env.example`.
- Fixes made along the way: renamed `vitest.config.ts` to `.mts` to remove an ESM warning; made `getCurrentUser()` read cookies so pages are rendered per request, not prerendered.

### Update: explicit grants (same day)
- The user's Supabase project has Data API on, automatic table exposure off, automatic RLS on, so the migrations must not assume API access.
- `0004_policies_storage.sql` now revokes everything from `anon`/`authenticated`/`service_role`, then grants exactly: `authenticated` SELECT on all 14 tables plus INSERT on `teacher_actions`; `service_role` only the statements the app and seed script use; `anon` nothing. `is_teacher()` execute was revoked from PUBLIC/anon.
- `teacher_actions` policy changed from "teacher manages (ALL)" to separate read and insert policies so the log is append-only for users.
- Added `supabase/verify_security.sql` (read-only checks to run in the Supabase SQL Editor) and `src/lib/db/migrations.test.ts`.
- Re-ran after this change: `npm run lint` passed, `npm run typecheck` passed, `npm test` passed (53 tests across 2 files: 46 migration guard checks plus the 7 AI/contract tests). `npm run build` was NOT re-run after this change (only SQL and a test file changed).

### Update: environment configuration (same day)
- Checked Supabase's current docs: keys are now "publishable" (`sb_publishable_...`, browser-safe) and "secret" (`sb_secret_...`, server only); `anon`/`service_role` are legacy and being deprecated by end of 2026.
- Renamed the variables to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (legacy names still accepted as fallbacks) via a small `src/lib/env.ts`.
- Created an empty `.env.local` template (Git-ignored; confirmed by `git check-ignore`). No secret was requested or handled by Cline.
- Added `npm run env:check` (and `env:check:live`), which never prints secret values; it flags a secret key in a public slot, identical keys, and `NEXT_PUBLIC_` on a secret name.
- Re-ran after this change: lint, typecheck, test (56 tests in 3 files) and build all passed (exit 0). `env:check` on the blank template correctly reported 6 MISSING items. `env:check:live` has NOT been run (needs the user's values).

### Update: live Supabase verification (10 Oct 2026)
The user filled `.env.local` and applied the migrations, seed content and `npm run seed:users` in their Supabase project. Cline never saw any key or password. Checks that actually ran:
- `npm run env:check`: all 7 items `[ok]` (URL, publishable key, secret key, 3 demo passwords, AI mode = mock).
- `npm run env:check:live`: concepts 4/4, resources 14/14, questions 9/9, question_keys 9/9, profiles = 3.
- New `npm run verify:rls` (`scripts/verify-rls.ts`) signs in as each fictional account and tests the rules: **25 of 25 checks passed**. It covers: logged-out visitors read nothing; a student sees only their own progress and profile; a student cannot read the other student's data or the answer keys; a student cannot edit their own progress or write a teacher action; the teacher sees the whole class and the keys; the teacher can add to the action log but not edit it; uploads: a student can write and read only their own folder, another student cannot read it, the teacher can. The test cleans up its two temporary records.
- `npm run lint` and `npm run typecheck` passed again after adding the script.
- Production smoke test (`next start`): `/login` returns 200 and contains the sign-in form; `/student`, `/student/homework`, `/teacher` and `/` return 307 redirects when logged out; the text `sb_secret_` is not present in the browser bundle (`.next/static`).

### Update: isolation re-verified with real sessions, migration 0005, ownership (10 Oct 2026)
- The earlier `verify:rls` script used the secret-key client for cleanup. It was replaced by `scripts/verify-isolation.ts` (+ `scripts/isolation/*`), which uses only the publishable key and each demo user's own session, never prints secrets, and never changes demo state (all write attempts target an impossible id and are expected to be refused).
- Result against the live project: **33 of 33 checks passed**: logged-out reads and writes on all 14 tables refused (`42501`); each student sees only their own profile and progress, cannot read the other student's or the teacher's rows, cannot read answer keys, cannot write learning/content/action-log tables, cannot perform a teacher action, cannot list or upload into the other student's folder; the teacher reads all class tables (3 profiles, both students' progress, 9 keys), cannot edit them directly and cannot record an action under another name.
- Limits stated by the script itself: row filtering is demonstrated with real data only for `profiles` and `concept_progress`; the other private tables are empty, storage has no files, and the teacher's successful `teacher_actions` insert is not exercised (it would leave a permanent audit row). Those rely on grant/policy text and on `supabase/verify_security_summary.sql`, which has NOT been run yet.
- No isolation failure was found. Review of the contracts did find two design gaps, fixed in new migration `0005_homework_diagnosis_and_generated_keys.sql` (not yet applied to the live project): homework diagnoses had no valid place to be saved (`diagnoses.answer_id` was NOT NULL), and generated reassessment/homework questions had nowhere to keep hidden answer keys (new teacher-only `generated_question_keys` table, with grants and RLS).
- Added `docs/TASKS.md` ownership (non-overlapping paths; AI and backend owns `src/lib/learning/**`), route contracts, acceptance criteria, `src/lib/db/ownership.test.ts` (admin client and secret key confined to persistence layers; no server modules in client files), and contract tests.
- Final local checks: lint, typecheck, test (72 tests in 5 files) and build all exit 0; `env:check` all `[ok]`.
- Git hygiene scan: `.env.local`, `node_modules`, `.next`, `*.tsbuildinfo`, `next-env.d.ts`, `*.log` are all ignored; the only env file Git would commit is `.env.example`; no key-like strings and no value copied from `.env.local` appear in any file to be committed.

### Pending before the foundation is merged (status as of the pull request)
1. **Migration 0005 is NOT applied.** The live project has migrations 0001-0004 and the two content seeds only. File: `supabase/migrations/0005_homework_diagnosis_and_generated_keys.sql`. Steps are in `docs/TASKS.md`, "Applying migration 0005".
2. **`supabase/verify_security_summary.sql` has NOT been run.** Expected after 0005: 14 rows, all PASS. Before 0005, rows 1, 8 and 14 correctly say FAIL.
3. After 0005 is applied, re-run `npm run verify:rls`; its new `generated_question_keys` checks only run once the table exists.

### Not verified yet
- The grants and policy definitions themselves (only their behaviour was tested, and only for tables/users listed above). Only the `is_teacher()` execute permission was inspected manually by the user from `verify_security.sql`; the other five listings in that file have not been inspected.
- Row filtering on tables that are still empty (see "Limits" above), cross-user file reads in storage, and the teacher's successful `teacher_actions` insert.
- Anything about the live AI provider (not implemented).
- The detailed rules in `Cline_AI_Builder_Hackathon_PS.pdf` (only partly readable).
- The in-browser sign-in flow was reported working by the user for Student A (reaches `/student`, bounced from `/teacher`) and the teacher (reaches the teacher page). Student B's browser login, sign-out, and the "other role's area" redirect for the teacher were not reported and have not been exercised by Cline or an automated browser.
- Commit identity was set for this repository only (user-supplied name and GitHub noreply email).

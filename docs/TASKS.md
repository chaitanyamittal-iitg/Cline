# Task ownership, contracts and acceptance criteria

Product source of truth: `Tech Doc - Team skill issue.pdf`. Shapes: `src/lib/contracts` (see `docs/CONTRACTS.md`).

## Ground rules for beginners

1. **One person = one branch = one set of files.** Do not edit files you do not own. If you need a change in
   someone else's file, message the owner (shared files: message the lead).
2. **Each person uses their own clone** (separate laptop, or a separate folder). Never share one working folder
   between two people or two Cline windows.
3. Never push to `main`. Push your branch and open a **pull request**; the lead merges.
4. Start every session: `git checkout main && git pull`, then `git checkout feat/<yours> && git merge main`.
5. Commit small and often. Run `npm run check` (lint, typecheck, tests, build) before opening a pull request.
6. Never commit `.env.local` or any key. Check `git status` before every commit.

## First-time setup (each teammate)

```
git clone https://github.com/chaitanyamittal-iitg/Cline.git safal-<yourname>
cd safal-<yourname>
git checkout feat/<your-branch>        # the lead creates the branches after the foundation is merged
npm install
copy .env.example .env.local           # Windows. The lead shares the Supabase URL + publishable key privately
npm run dev
```

Teammates get the URL and publishable key. Only the lead holds the secret key and demo passwords until
the backend owner needs them (they get their own `.env.local`; never commit it, never put it in chat).

## Who owns what (no file has two owners)

| Role | Branch | Owns exactly these paths |
|---|---|---|
| **Lead** (shared files) | `feat/foundation`, then `main` | `supabase/**`, `src/lib/contracts/**`, `src/lib/ai/types.ts`, `src/lib/ai/index.ts`, `src/lib/ai/providers/mock.ts`, `src/lib/env.ts`, `src/lib/auth.ts`, `src/lib/supabase/**`, `src/proxy.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/login/**`, `src/app/student/layout.tsx`, `src/app/teacher/layout.tsx`, `src/components/AppShell.tsx`, `scripts/**` (except `scripts/demo/**`), `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, config files, `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/TASKS.md`, `docs/BUILD_LOG.md` (teammates send the lead one line per Cline session to add), `src/lib/db/**` |
| **Student flow** | `feat/student` | `src/app/student/page.tsx`, `src/app/student/[concept]/**`, `src/components/student/**`, `src/lib/student/**` (read-only queries made with the student's own session) |
| **AI and backend** (also owns learning-state orchestration and persistence) | `feat/ai` | `src/lib/learning/**`, `src/lib/ai/providers/live.ts`, `src/lib/ai/prompts/**`, `src/app/api/progress/**`, `src/app/api/attempts/**`, `src/app/api/answers/**`, `src/app/api/tutor/**`, `src/app/api/support/**`, `src/app/api/upload/**` |
| **Homework** | `feat/homework` | `src/app/student/homework/**`, `src/components/homework/**`, `src/lib/homework/**`, `src/app/api/homework/**` |
| **Teacher dashboard** | `feat/teacher` | `src/app/teacher/page.tsx`, `src/app/teacher/students/**`, `src/components/teacher/**`, `src/lib/teacher/**` (read-only queries made with the teacher's own session), `src/app/api/teacher/**` |
| **Tests and demo** | `feat/tests-demo` | `tests/**`, `scripts/demo/**`, `docs/DEMO_SCRIPT.md`, `docs/SUBMISSION.md`, `public/diagrams/**` |

Unit tests for your own code go next to it (`something.test.ts`), inside your own folders. Tests/demo owns the
cross-feature tests in `tests/**`.

## Shared learning-state orchestration and persistence: owner is **AI and backend**

Exactly one place may change a student's learning state or write learning records: **`src/lib/learning/**`**,
owned by AI and backend. Everyone else calls it (through the API routes) and never writes those tables.

- It is the only code (besides `src/lib/homework/**` for homework tables and `scripts/seed-users.ts` for the
  demo reset) allowed to call `createSupabaseAdminClient()`. `src/lib/db/ownership.test.ts` fails the build if
  any other file does. Teacher actions also go through it (`src/lib/learning/teacher-actions.ts`), because
  they change `concept_progress`.
- It enforces the rules in the tech doc, in code and not in the UI: legal state transitions only (see
  `docs/ARCHITECTURE.md`), **at most two support/reassessment cycles** (then `teacher_flagged`), `passed`
  never moves a student on, and only a teacher action sets `teacher_cleared_to_next`.
- It checks who is calling (`requireStudent()` / `requireTeacher()`), then uses the student's own `user.id`
  for every write. It never trusts a student id sent by the browser.
- Student and teacher screens read data with the **user's own session** (RLS applies), never the secret key.
- Teacher-facing students are identified by id; students can only ever act on their own id.

## API contracts (shapes live in `src/lib/contracts/api.ts`; all return `ApiResult<T>`)

| # | Route | Request to response | Who calls it | Implemented by |
|---|---|---|---|---|
| 1 | `POST /api/progress/advance` | `AdvanceProgressRequest` to `AdvanceProgressResponse` (`lesson` to `doubts` only) | Student flow | AI and backend |
| 2 | `POST /api/tutor` | `AskTutorRequest` to `AskTutorResponse` (approved resources only; saves both messages) | Student flow | AI and backend |
| 3 | `POST /api/attempts/start` | `StartMicrotestRequest` to `StartMicrotestResponse` (to `microtest`; prompts only, no keys; idempotent) | Student flow | AI and backend |
| 4 | `POST /api/upload` | multipart (`UploadFields` + `file`, JPEG/PNG/WebP, max 5 MB) to `UploadResponse` | Student flow, Homework | AI and backend |
| 5 | `POST /api/answers` | `SubmitAnswersRequest` to `SubmitAnswersResponse` (right/wrong, diagnoses, new progress, optional follow-up) | Student flow | AI and backend |
| 6 | `POST /api/support` | `StartSupportRequest` to `StartSupportResponse` (support + fresh reassessment; refuses a 3rd cycle) | Student flow | AI and backend |
| 7 | `POST /api/homework/generate` | none to `GenerateHomeworkResponse` | Homework UI | Homework |
| 8 | `POST /api/homework/submit` | `SubmitHomeworkRequest` to `ApiResult<{ submitted: true }>` | Homework UI | Homework |
| 9 | `POST /api/teacher/action` | `TeacherActionRequest` to `TeacherActionResponse` | Teacher dashboard | Teacher (route), AI and backend (`lib/learning/teacher-actions.ts`) |

Rules that apply to every route: validate the body with its Zod schema; return `{ ok: false, error }` with a
plain-English message (never a stack trace or key); call `requireStudent()` or `requireTeacher()` first; use
only `approved = true` resources; label AI output with `source`.

Reads (no route needed): the Student flow and Teacher dashboard read lessons, questions, progress, answers and
diagnoses directly with the signed-in user's session, from their own `src/lib/student|teacher/**` helpers.
**Support-plan and reassessment display:** students read `support_cycles.support` and `attempts.questions`
(prompts only; expected ideas are stored in `generated_question_keys`, which only the teacher can read).

## Dependencies and order of work

```
Foundation (done)  ->  AI and backend: learning/ + routes 1-6 (mock AI)   ->  Student flow screens call them
                                              |                                  ^
                                              +->  Teacher action (route 9)  ->  Teacher dashboard
Homework starts from the contracts + mock AI (routes 7-8) and does not wait for the others.
Tests and demo prepares rehearsal data and the script from day one; runs the end-to-end rehearsal last.
```

- Student flow can build every screen against the mock responses in `docs/CONTRACTS.md` before routes exist.
- Nobody waits for live AI: everything works with `AI_PROVIDER=mock` first; live replaces `providers/live.ts` only.
- If you need a **new table, column, contract field or package**, ask the lead. Do not create tables by hand in
  the Supabase dashboard (automatic exposure is OFF, so unmanaged tables are unusable anyway).

## Acceptance criteria (a branch is ready for a pull request when all are true)

**Student flow (`feat/student`)**
- Student A and B each see the Complete circuits journey in order: lesson video + reading, doubt step, written
  micro-test, feedback, support, reassessment, outcome. State survives a page refresh and a new login.
- Doubt step shows the tutor reply plus an approved diagram/graphic/video when `resourceId` is set; "no more doubts" starts the test.
- Micro-test accepts typed text or an uploaded photo per question; shows right/wrong only, **no number anywhere**; shows the MOCK AI / Live AI badge.
- Works at tablet width (about 768 px) and phone width. Touch targets at least 44 px.
- Never reads answer keys; never writes learning tables directly (calls routes 1-6).

**AI and backend (`feat/ai`)**
- All of routes 1-6 plus `lib/learning/**` work with the mock provider for C3, and then with live AI behind `AI_PROVIDER=live`.
- Diagnosis marks a correct answer with faulty reasoning as `isCorrect: true, reasoningSound: false`, and asks a follow-up instead of guessing when reasoning is unclear.
- Third support cycle is refused and the student becomes `teacher_flagged` after the second failed reassessment; unit tests prove it, including illegal transitions.
- Handwritten image is stored under `<studentId>/...` with the student's own session; the interpreted text goes through the same diagnosis path as typed text.
- A student can never act on another student's id; a student cannot call the teacher action; API errors never leak keys or stack traces.
- Prompts include only approved resources. Live provider fails with a clear message, never fakes mock output as live.

**Homework (`feat/homework`)**
- Generating homework uses the day's diagnoses across concepts; one set per student per day (`homework.unique(student_id, for_date)`); generated expected ideas are stored in `generated_question_keys`.
- A student can open and submit homework from any device after logging in; submitted answers use the same answer-and-reasoning diagnosis, and the results are saved so later support can use them.
- No scores; right/wrong feedback only. Teacher approval is not required.

**Teacher dashboard (`feat/teacher`)**
- Lists the two students with current concept and status ("Working normally" / "Teacher attention needed"). No ranking, pacing or analytics.
- Student detail shows typed and uploaded answers (signed image URLs), the likely misconception, support given and reassessment result.
- Teacher can approve the next concept, clear a flag, add a note, assign support or override a diagnosis, all through route 9, and each action is recorded in `teacher_actions`.

**Tests and demo (`feat/tests-demo`)**
- A repeatable reset of both demo accounts (a wrapper around `npm run seed:users`) and a written demo script covering Student A (needs a complete circuit) and Student B (conductor vs insulator) to the flag at two failed cycles.
- Cross-feature tests in `tests/**`; `npm run check` green; `npm run verify:rls` all PASS after the final merge.
- Draft diagram SVGs for the placeholder paths in `supabase/seed/content_1_concepts_resources.sql`; the submission notes, PPT outline and recording checklist.

## Applying migration 0005 (DONE on the shared Supabase project on 10 Oct 2026; keep for anyone creating a fresh project)

`supabase/migrations/0005_homework_diagnosis_and_generated_keys.sql` fixes two gaps found while defining the
contracts (homework diagnoses had nowhere to be saved; generated questions had nowhere to keep hidden keys).
It does not edit migrations 0001-0004. Status: applied; the lead reported 14 of 14 PASS on the summary query
and 41 of 41 on `npm run verify:rls`. Teammates share this one project, so they do **not** apply it again.

1. Supabase dashboard, **SQL Editor**, new query, paste the whole file, **Run**. It should say success.
2. Run `supabase/verify_security_summary.sql` in a new query. **Expected: 14 rows, every `result` says PASS.**
3. Run `npm run verify:rls` locally. Expected: every line `[PASS]`.

## Known test gap to close during rehearsal (owner: Tests and demo)

Most private tables and the `student-work` bucket were empty when isolation was verified, so cross-user reads of
real records and real files are untested. After the first full run-through (both students have answers,
diagnoses, support cycles, homework and uploads), re-run `npm run verify:rls` and manually confirm Student A
cannot open Student B's uploaded image and the teacher can.

## Shared-rule reminders

- Fictional data only. Show the AI badge wherever AI output appears. No scores, rankings, analytics or MCQs.
- Tutor, questions and visuals come only from `resources` rows with `approved = true`.
- When a lead-owned file must change, the lead makes it on `main` and everyone merges `main` into their branch.

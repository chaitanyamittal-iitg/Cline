# Backend Stage 1: typed-answer journey and teacher approval

Owner: AI and backend (feat/ai). Status is stated per item as **implemented**, **unit-tested** or **tested over real HTTP
with signed-in demo sessions**. Nothing below is claimed beyond what actually ran; see "What ran" at the end.

## API-safe authentication (for the Teacher worker, and everyone writing `src/app/api/**`)

`requireStudent()` / `requireTeacher()` (in `src/lib/auth.ts`) **redirect** to the login page. That is right for pages and
wrong for an API route: a failed login would become a 307 to HTML and `fetch().json()` would break. Use
`src/lib/learning/api-auth.ts` in every route handler instead:

```ts
import { authenticateApi, readJsonBody, teacherActionResponse } from "@/lib/learning/api-auth";
import { TeacherActionRequestSchema } from "@/lib/contracts";
import { applyTeacherAction } from "@/lib/learning/teacher-actions";

export async function POST(request: Request) {
  const auth = await authenticateApi("teacher");   // not signed in -> 401 JSON, a student -> 403 JSON, never a redirect
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request, TeacherActionRequestSchema);   // malformed or off-contract -> 400 JSON
  if (!body.ok) return body.response;
  return teacherActionResponse(await applyTeacherAction(auth.user, body.data));
}
```

Rules: the acting user is always `auth.user` (the server session); never read a user id from the body. Responses are the
`{ ok, data | error }` envelope. `teacherActionResponse` maps `forbidden 403, invalid_input 400, not_found 404,
rule_violation 409, not_implemented 501, internal 500`. A guard test (`routes.test.ts`) fails if any file under
`src/app/api` calls `requireStudent`, `requireTeacher` or `redirect`. **`/api/teacher/action` belongs to the Teacher worker; this
milestone did not create or edit it.**

## Routes and services (Stage 1)

| Route | Service | Notes |
|---|---|---|
| `POST /api/progress/advance` | `progress-service.ts` `advanceProgress` | One conditional UPDATE (`lesson` to `doubts`); repeat in `doubts` is harmless |
| `POST /api/attempts/start` | `progress-service.ts` `startMicrotest` | Atomic (`safal_start_microtest`); returns the same open attempt on retry; prompts only |
| `POST /api/answers` | `answers-service.ts` `submitAnswers` | Typed text only in this stage; photo answers are refused with a plain message |
| `POST /api/answers/follow-up` | `answers-service.ts` `submitFollowUp` | Same attempt resumes; one reply per question; never uses a cycle |
| teacher `approve_next_concept`, `note` | `teacher-persist.ts` via `applyTeacherAction` | `override_diagnosis`, `assign_support`, `clear_flag` still return `not_implemented` |

Not built yet (later stages): tutor, upload, support/reassessment route, the other three teacher actions.

How a sitting is saved: the service reads with the **caller's own id** (never an id from the body), asks the AI provider for
one diagnosis per question (mock unless `AI_PROVIDER=live`; every diagnosis keeps its `source`), applies `rules.ts`
(`decideSave`), then saves answers + diagnoses + the new state in **one** database function. A retry returns the saved
result and writes nothing. If the AI call fails nothing is saved and the student sees a plain "try again" message; no
verdict is ever invented.

## Migration 0007: the file to apply

`supabase/migrations/0007_learning_loop_functions.sql` (six functions, no table, no policy, no table grant). Apply **once**,
after 0001-0006. Do not re-run earlier migrations or the seed.

1. Supabase > SQL Editor > New query > paste the whole file > Run. Expected: success, no rows.
2. **Structural check** (does it exist and is it locked down?): run `supabase/verify_0007.sql`. Expected: 4 rows, all PASS.
   This only reads the catalog. It does NOT prove the functions behave correctly.
3. Re-run `supabase/verify_security_summary.sql`. Expected: still 14 PASS.
4. **Execution check** (do they actually run?): with the app built (`npm run build`) and started (`npm run start -- -p 3100`)
   on Windows, run `npm run verify:stage1`. Its preflight calls a function against a student that does not exist and
   expects `not_found`; then it walks Student B through the journey over real HTTP.

Review notes on 0007 (schema compatibility): column names and checks match 0001-0006 (`answers.kind`, `clarifies_answer_id`,
`confirmed_text`, `reading_status`, `diagnoses.answer_id` nullable, `generated_question_keys`); every table written is one
`service_role` already has the needed grant on; functions run as the caller (not `security definer`), are revoked from
`public`, `anon` and `authenticated`, and granted to `service_role` only. Each locks the student's `concept_progress` row.
`verify_0007.sql` checks the permissions; `migrations.test.ts` checks the SQL text for the same rules. None of this
has run on a database until step 1 is done.

## What ran (honest record)

- `npm run lint`, `typecheck`, `test` (174 tests in 12 files) and `build` (lists the four new routes): all exit 0.
- `npm run verify:stage1` against the real production build running on port 3100, with real signed-in demo sessions:
  **9 passed, 1 failed.** The 9 passes are the HTTP authentication checks on all four routes (unsigned = 401 JSON with no
  redirect, teacher on a student route = 403 JSON with no redirect) plus a 400 JSON for an off-contract body.
  The 1 failure is the preflight: **migration 0007 is not applied** (`PGRST202`, function not found).
- **Not yet run:** the journey (advance, start, answers, retry, follow-up), ownership rejection across two students, the
  persisted-state checks, and teacher approval/note persistence. They need 0007 applied, then `npm run verify:stage1` again.
  The `[BLOCKED]` line in the script output says so explicitly; nothing is reported as passing that did not run.
- Unit tests cover the pure logic (outcome, cycles, clarification, saved-result reconstruction, auth helper, teacher
  authorization with persistence replaced). They do not exercise the database functions.
- The Teacher worker's `/api/teacher/action` route does not exist on this branch, so the teacher script prints `[SKIP]` for the
  HTTP check of that route; persistence will be exercised by calling `persistApproval` / `persistNote` directly, which does
  not prove route authentication.

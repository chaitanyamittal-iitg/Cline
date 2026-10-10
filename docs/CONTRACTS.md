# Shared interfaces

All shapes live in `src/lib/contracts` (Zod schemas, TypeScript types inferred). **Lead-only file.**
If you need a field changed, message the lead with what you need and why; do not edit it on your branch.

Import everything from one place:

```ts
import { DiagnosisSchema, type Diagnosis, type ApiResult } from "@/lib/contracts";
```

## Learning data (`learning.ts`)

| Type | Purpose |
|---|---|
| `ConceptId` | `"C1" \| "C2" \| "C3" \| "C4"` |
| `LearningState` | `lesson, doubts, microtest, analysis, support, reassessment, passed, teacher_flagged` |
| `ConceptProgress` | A student's state for one concept, support cycles used (0-2), flag, teacher clearance |
| `Question` | What the student sees (prompt only) |
| `QuestionKey` | Expected idea + misconceptions. **Server only.** |
| `AnswerInput` | `typedText`, or `uploadPath` + the student's `confirmedText` (handwriting), or both kinds |
| `HandwritingReading` | AI draft of an image: `status` `read` / `unclear` / `not_read`, `draftText`, `source`. Always confirmed by the student |
| `AttemptOutcome` | `awaiting_clarification`, `succeeded`, `struggled`, `unclear_needs_teacher` |
| `FollowUp` | One open clarification: `questionId` + `question` |
| `Diagnosis` | `isCorrect`, `reasoningSound`, `misconception`, `evidence`, `nextAction`, `followUpQuestion`, `source` |
| `SupportPlan` | Targeted explanation, guiding question, practice task, approved resource ids |
| `Reassessment` | Fresh generated questions for one support cycle |
| `Homework` / `HomeworkItem` | Daily personalised homework |
| `TeacherActionInput` | Discriminated union on `action`: `approve_next_concept`, `override_diagnosis`, `assign_support`, `clear_flag`, `note` (details below) |

Rules baked into the types:
- There is **no numeric score** field. Results are `isCorrect: boolean`.
- `isCorrect: true` with `reasoningSound: false` represents a right answer with faulty reasoning.
- Every AI output has `source: "mock" | "live"`. The UI must show it.
- `MAX_SUPPORT_CYCLES = 2`.

## Requests and responses (`api.ts`)

Every route returns `ApiResult<T>` = `{ ok: true, data } | { ok: false, error }`.

The authoritative route table (who calls, who implements, acceptance criteria) is in `docs/TASKS.md`.

| Endpoint (planned) | Request | Response | Implemented by |
|---|---|---|---|
| `POST /api/progress/advance` | `AdvanceProgressRequest` | `AdvanceProgressResponse` | AI and backend |
| `POST /api/tutor` | `AskTutorRequest` | `AskTutorResponse` | AI and backend |
| `POST /api/attempts/start` | `StartMicrotestRequest` | `StartMicrotestResponse` | AI and backend |
| `POST /api/upload` | multipart: `UploadFields` + `file` | `UploadResponse` | AI and backend |
| `POST /api/answers` | `SubmitAnswersRequest` | `SubmitAnswersResponse` | AI and backend |
| `POST /api/answers/follow-up` | `FollowUpRequest` | `FollowUpResponse` (same shape as `SubmitAnswersResponse`) | AI and backend |
| `POST /api/support` | `StartSupportRequest` | `StartSupportResponse` | AI and backend |
| `POST /api/homework/generate` | none | `GenerateHomeworkResponse` | Homework |
| `POST /api/homework/submit` | `SubmitHomeworkRequest` | `ApiResult<{ submitted: true }>` | Homework |
| `POST /api/teacher/action` | `TeacherActionRequest` | `TeacherActionResponse` | Teacher + AI and backend |

The routes do not exist yet. These are the agreed shapes to build against.

## Student contract: clarification (follow-up) and handwriting

**Clarification resumes the same attempt.** `POST /api/answers` may return `attemptOutcome: "awaiting_clarification"`
with `followUps: [{ questionId, question }]` and `isCorrect: null` for those questions ("no verdict yet").
The student answers each follow-up with `POST /api/answers/follow-up` (`{ conceptId, attemptId, questionId, response }`).
The response has the same shape, so one screen handles both. Rules (enforced by `src/lib/learning/rules.ts`):

- One clarification per question (`MAX_CLARIFICATIONS_PER_QUESTION = 1`), only for a question with an open follow-up.
- A clarification **never** uses up a support/reassessment cycle and never counts as a failure.
- The reply is stored as a second `answers` row (`kind = 'clarification'`, `clarifies_answer_id` set). The original is never overwritten.
- After the clarification the question is diagnosed again using both texts (`DiagnoseInput.clarification`).
- If it is **still unclear**, the outcome is `unclear_needs_teacher`: the student is flagged for the teacher. Unclear work is never an automatic failure.
- Outcome precedence: open clarification, then any clear gap (`struggled`), then still-unclear (`unclear_needs_teacher`), then `succeeded`. A correct answer with faulty reasoning is a clear gap, not a success.
- `succeeded` moves the student only to `passed`; the teacher approves moving on.

**Handwriting is always confirmed by the student before diagnosis.** `POST /api/upload` returns
`{ uploadPath, reading: { status, draftText, source } }`:

| `reading.status` | Meaning | Screen |
|---|---|---|
| `read` | The provider really read the image | Editable box with `draftText`: "Is this what you wrote?" |
| `unclear` | It tried but is not sure | Show any partial `draftText`; ask the student to type or fix it |
| `not_read` | Nothing was read. **Mock mode always returns this.** | Say plainly the picture could not be read; ask the student to type what it says. Never show invented text |

The answer is then sent as `{ questionId, uploadPath, confirmedText }`. `confirmedText` is required with `uploadPath` and
forbidden without it. The server diagnoses `typedText` / `confirmedText` only, never a raw AI reading, and keeps the AI
draft separately (`answers.interpreted_text`, `reading_status`) for the teacher to compare. Needs migration 0006.

## Teacher actions (`POST /api/teacher/action`)

Request: `TeacherActionInput` (a union on `action`). The request has **no teacher id**: the actor is always the signed-in
teacher from the server session. `studentId` only names the target. Response:
`{ progress, nextProgress, alreadyApplied }`.

| Action | Extra fields | Does | Never does |
|---|---|---|---|
| `approve_next_concept` | optional `overrideUnderstanding`, `note` | Sets `teacher_cleared_to_next` on the current concept; creates the next concept's `concept_progress` row in `lesson` if absent | Rewrite the diagnosis; reset an existing next row; use ID arithmetic |
| `override_diagnosis` | `diagnosisId`, `replacement`, **required** `note` | Records the replacement and what changed in `teacher_actions.payload` | Edit the `diagnoses` row or the student's work; approve progression |
| `assign_support` | `support` (typed content), optional `note` | Adds teacher support beside automated support | Touch `support_cycles_used`; allow a third automated cycle; approve progression |
| `clear_flag` | optional `note` | Sets `teacher_flagged = false` | Change `state`, cycle count or approval |
| `note` | **required** `note` | Appends an audit row | Change learning state |

Approval details:
- If the current state is not `passed`, the teacher must send `overrideUnderstanding: true` **and** a note; otherwise `rule_violation`. The audit payload records `overrideUnderstanding`, `stateAtApproval` and `nextConceptId`.
- The next concept is the next entry in curriculum order (`concepts.position` ascending), never `id + 1`.
- On the last concept the approval is recorded, `nextProgress` is `null` and no new concept is invented.
- Repeating an approval returns `alreadyApplied: true` and writes nothing. If an earlier approval was interrupted before the next row existed, only that missing row is added.
- `progress` is always the **current** concept's progress; `nextProgress` is the next concept's row after an approval, otherwise `null`.

Audit rows are in `teacher_actions` (`teacher_id` = session teacher, `payload` shaped by `ApproveNextPayload`,
`OverrideDiagnosisPayload` or `AssignSupportPayload`). Each action that changes something writes exactly one row.
### Backend entry point (`src/lib/learning/teacher-actions.ts`)

```ts
export type TeacherActor = Pick<CurrentUser, "id" | "role">;
export async function applyTeacherAction(actor: TeacherActor, rawInput: unknown): Promise<TeacherActionResult>;
// TeacherActionResult = { ok: true; data: TeacherActionResponse } | { ok: false; error: string; code: TeacherActionErrorCode }
// codes: forbidden 403, invalid_input 400, not_found 404, rule_violation 409, not_implemented 501, internal 500
```

The route (Teacher worker) does: `const teacher = await requireTeacher(); const r = await applyTeacherAction(teacher, await req.json());`
then maps `r.code` to the HTTP status. Inside, the function re-checks the session (a made-up `actor` fails), validates, and
only then writes. Order: authorization, validation, privileged writes.

**Persistence is NOT implemented yet.** Today a valid request returns `{ ok: false, code: "not_implemented" }` (HTTP 501).
It never fakes success and never writes. `TEACHER_ACTIONS_PERSISTENCE_READY` is `false`. The Teacher worker builds the screen
against the contract and shows `not_implemented` as "saving is not ready yet". Pure rules already exist and are tested:
`planApproval`, `changedDiagnosisFields`, `clearFlag` in `src/lib/learning/teacher-rules.ts`.

> **Stage 1 update:** `approve_next_concept` and `note` now persist (see `docs/BACKEND_STAGE1.md`, including the
> API-safe authentication pattern with JSON 401/403 for API routes). The other three actions still return `not_implemented`.

### Persistence checklist (AI and backend owner)

Do all writes with `createSupabaseAdminClient()` after the authorization check, inside `src/lib/learning/**`:
1. Load `concept_progress` for (`studentId`, `conceptId`); `not_found` if missing. Load the curriculum from `concepts` ordered by `position`.
2. `approve_next_concept`: call `planApproval`; if `ok: false` return `rule_violation`. Update the current row; insert the next row with `on conflict do nothing`; then insert the audit row.
3. `override_diagnosis`: load the diagnosis (must belong to the student and concept), build the payload with `changedDiagnosisFields` (reject with `rule_violation` if nothing changed), store it in `teacher_actions.payload`. Do not update `diagnoses`.
4. `assign_support`: check every `resourceId` is an approved resource of the same concept; store the content in `teacher_actions.payload` and show it to the student next to automated support.
5. `clear_flag`: update only `teacher_flagged`.
6. Approval must be idempotent (the unique `(student_id, concept_id)` already protects the next row).
7. Set `TEACHER_ACTIONS_PERSISTENCE_READY = true` and replace the `not_implemented` test with persistence tests.

## Access model by machine

- **Macs (frontend workers):** session-scoped Supabase access only: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, signed in as a demo user. RLS applies. They never hold `SUPABASE_SECRET_KEY`.
- **Windows (lead + AI/backend):** the only machine with the secret key, so **privileged integration runs here for now**. A route that writes learning state returns an error such as "SUPABASE_SECRET_KEY is not set" on a Mac. That is expected: build the screen against the contract, then test integration on Windows.

## Migration 0006 (`supabase/migrations/0006_clarification_and_handwriting.sql`)

Adds columns to `answers` only: `kind`, `clarifies_answer_id`, `confirmed_text`, `reading_status`, two unique indexes and two
constraints. No new table, grant or policy. **Status: written, NOT applied.** Apply once in Supabase SQL Editor, then run
`supabase/verify_0006.sql` (expected: 7 rows, all PASS) and `supabase/verify_security_summary.sql` (expected: still 14 PASS).

## AI interface (`src/lib/ai/types.ts`)

```ts
interface AiProvider {
  label: string; source: "mock" | "live";
  answerDoubt(input): Promise<TutorOutput>;
  interpretHandwriting(input): Promise<InterpretHandwritingOutput>;
  diagnose(input): Promise<Diagnosis>;
  createSupport(input): Promise<SupportPlan>;
  createReassessment(input): Promise<Reassessment>;
  createHomework(input): Promise<HomeworkOutput>;
}
```

`interpretHandwriting` returns `{ reading: HandwritingReading }`. The mock always returns `status: "not_read"` with no text:
it never pretends to read an image. `diagnose` takes the student-confirmed text as `studentAnswer` and an optional `clarification`.

Get one with `getAiProvider()` (reads `AI_PROVIDER`; default and `mock` give the labelled mock).
`live.ts` currently throws `LiveAiNotConfiguredError`. The AI teammate fills it in.
Always pass only teacher-approved resources (`approved = true`) in `approvedResources`.

## Server-side helpers

- `requireStudent()` / `requireTeacher()` from `@/lib/auth` at the top of every page or action.
- `createSupabaseServerClient()` acts as the logged-in user (RLS applies).
- `createSupabaseAdminClient()` bypasses RLS. Use only on the server, only after checking the user, and only to write learning state.

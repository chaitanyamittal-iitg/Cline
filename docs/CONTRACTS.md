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
| `AnswerInput` | `typedText` and/or `uploadPath` (at least one) |
| `Diagnosis` | `isCorrect`, `reasoningSound`, `misconception`, `evidence`, `nextAction`, `followUpQuestion`, `source` |
| `SupportPlan` | Targeted explanation, guiding question, practice task, approved resource ids |
| `Reassessment` | Fresh generated questions for one support cycle |
| `Homework` / `HomeworkItem` | Daily personalised homework |
| `TeacherActionInput` | `approve_next_concept, override_diagnosis, assign_support, clear_flag, note` |

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
| `POST /api/support` | `StartSupportRequest` | `StartSupportResponse` | AI and backend |
| `POST /api/homework/generate` | none | `GenerateHomeworkResponse` | Homework |
| `POST /api/homework/submit` | `SubmitHomeworkRequest` | `ApiResult<{ submitted: true }>` | Homework |
| `POST /api/teacher/action` | `TeacherActionRequest` | `TeacherActionResponse` | Teacher + AI and backend |

The routes do not exist yet. These are the agreed shapes to build against.

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

Get one with `getAiProvider()` (reads `AI_PROVIDER`; default and `mock` give the labelled mock).
`live.ts` currently throws `LiveAiNotConfiguredError`. The AI teammate fills it in.
Always pass only teacher-approved resources (`approved = true`) in `approvedResources`.

## Server-side helpers

- `requireStudent()` / `requireTeacher()` from `@/lib/auth` at the top of every page or action.
- `createSupabaseServerClient()` acts as the logged-in user (RLS applies).
- `createSupabaseAdminClient()` bypasses RLS. Use only on the server, only after checking the user, and only to write learning state.

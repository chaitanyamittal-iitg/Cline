// SAFAL shared contracts, part 2: request/response shapes for server actions and routes.
// LEAD-OWNED. Teammates implement these; they do not change them without the lead.
import { z } from "zod";
import {
  AnswerInputSchema,
  AttemptOutcomeSchema,
  ConceptIdSchema,
  ConceptProgressSchema,
  DiagnosisSchema,
  FollowUpSchema,
  HandwritingReadingSchema,
  HomeworkSchema,
  QuestionSchema,
  ReassessmentSchema,
  SupportPlanSchema,
  TeacherActionInputSchema,
} from "./learning";

/** Every API returns this envelope so the UI handles errors the same way everywhere. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

// POST /api/progress/advance  (student finished the lesson + reading and moves to the doubt step)
export const AdvanceProgressRequestSchema = z.object({
  conceptId: ConceptIdSchema,
  to: z.literal("doubts"),
});
export type AdvanceProgressRequest = z.infer<typeof AdvanceProgressRequestSchema>;
export const AdvanceProgressResponseSchema = z.object({ progress: ConceptProgressSchema });
export type AdvanceProgressResponse = z.infer<typeof AdvanceProgressResponseSchema>;

// POST /api/attempts/start  (student has no more doubts: moves to 'microtest' and opens the predefined test)
// Idempotent: if an unanswered micro-test attempt already exists for this concept, it is returned again.
export const StartMicrotestRequestSchema = z.object({ conceptId: ConceptIdSchema });
export type StartMicrotestRequest = z.infer<typeof StartMicrotestRequestSchema>;
export const StartMicrotestResponseSchema = z.object({
  attemptId: z.string().uuid(),
  /** Prompts only. The answer keys never leave the server. */
  questions: z.array(QuestionSchema).min(1),
  progress: ConceptProgressSchema,
});
export type StartMicrotestResponse = z.infer<typeof StartMicrotestResponseSchema>;

// POST /api/answers  (Student interface + AI integration)
export const SubmitAnswersRequestSchema = z.object({
  conceptId: ConceptIdSchema,
  attemptId: z.string().uuid(),
  answers: z.array(AnswerInputSchema).min(1),
});
export type SubmitAnswersRequest = z.infer<typeof SubmitAnswersRequestSchema>;

export const SubmitAnswersResponseSchema = z.object({
  /**
   * Right/wrong per question, never a number. `null` means "no verdict yet": the work was unclear and a
   * follow-up is open (see `followUps`). Show "needs a quick clarification", never "wrong".
   */
  results: z.array(z.object({ questionId: z.string(), isCorrect: z.boolean().nullable() })),
  diagnoses: z.array(DiagnosisSchema),
  progress: ConceptProgressSchema,
  /** Open clarifications, one per unclear question. Empty when nothing is pending. */
  followUps: z.array(FollowUpSchema),
  /** Where this sitting stands. `awaiting_clarification` means the attempt is still open. */
  attemptOutcome: AttemptOutcomeSchema,
});
export type SubmitAnswersResponse = z.infer<typeof SubmitAnswersResponseSchema>;

// POST /api/answers/follow-up  (student answers ONE open clarification and the SAME attempt resumes)
// Allowed only for a question that has an open follow-up in this attempt, once per question. The reply is stored as a
// "clarification" answer linked to the original, the question is diagnosed again using both texts, and the
// attempt is re-evaluated. A clarification is never counted as an unsuccessful support/reassessment cycle.
// Typed text only. Returns the same shape as POST /api/answers so the screen handles both the same way.
export const FollowUpRequestSchema = z.object({
  conceptId: ConceptIdSchema,
  attemptId: z.string().uuid(),
  questionId: z.string(),
  response: z.string().trim().min(1).max(2000),
});
export type FollowUpRequest = z.infer<typeof FollowUpRequestSchema>;
export const FollowUpResponseSchema = SubmitAnswersResponseSchema;
export type FollowUpResponse = SubmitAnswersResponse;

// POST /api/tutor  (doubt step)
export const AskTutorRequestSchema = z.object({
  conceptId: ConceptIdSchema,
  message: z.string().trim().min(1).max(2000),
});
export type AskTutorRequest = z.infer<typeof AskTutorRequestSchema>;

export const AskTutorResponseSchema = z.object({
  reply: z.string(),
  /** Id of an APPROVED diagram/graphic/video to show beside the reply, if one helps. */
  resourceId: z.string().nullable(),
  source: z.enum(["mock", "live"]),
});
export type AskTutorResponse = z.infer<typeof AskTutorResponseSchema>;

// POST /api/support  (create support plan + reassessment after analysis)
export const StartSupportRequestSchema = z.object({ conceptId: ConceptIdSchema });
export type StartSupportRequest = z.infer<typeof StartSupportRequestSchema>;

export const StartSupportResponseSchema = z.object({
  support: SupportPlanSchema,
  reassessment: ReassessmentSchema,
  /** Student-safe copy: prompts only, no expected ideas. */
  reassessmentQuestions: z.array(QuestionSchema),
  attemptId: z.string().uuid(),
  progress: ConceptProgressSchema,
});
export type StartSupportResponse = z.infer<typeof StartSupportResponseSchema>;

// POST /api/upload  (handwritten image -> private storage -> optional AI draft reading, for the student to CONFIRM)
// Sent as multipart/form-data with the fields in UploadFieldsSchema plus one file field named "file".
// The server stores the image at "<studentId>/<attemptId>-<questionId>-<timestamp>.<ext>" using the STUDENT'S OWN
// session (so the storage policy applies).
// The AI reading is only a DRAFT. The student always confirms or corrects it, and submits that text as
// AnswerInput.confirmedText next to uploadPath. The server diagnoses typedText/confirmedText, never a raw AI reading,
// and stores the AI draft separately (answers.interpreted_text) for the teacher.
//   reading.status "read"     -> show draftText in an editable box: "Is this what you wrote?"
//   reading.status "unclear"  -> show any partial draftText and ask the student to type or fix it
//   reading.status "not_read" -> nothing was read (ALWAYS the case in mock mode): say so plainly and ask the
//                                student to type what the handwriting says. Never show invented text.
// Unclear handwriting is therefore resolved by the student before diagnosis and is never counted as a failure.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const UploadFieldsSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string(),
});
export type UploadFields = z.infer<typeof UploadFieldsSchema>;
export const UploadResponseSchema = z.object({
  uploadPath: z.string(),
  reading: HandwritingReadingSchema,
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

// Homework
export const GenerateHomeworkResponseSchema = z.object({ homework: HomeworkSchema });
export type GenerateHomeworkResponse = z.infer<typeof GenerateHomeworkResponseSchema>;

export const SubmitHomeworkRequestSchema = z.object({
  homeworkId: z.string().uuid(),
  answers: z.array(AnswerInputSchema).min(1),
});
export type SubmitHomeworkRequest = z.infer<typeof SubmitHomeworkRequestSchema>;

// Teacher: POST /api/teacher/action
// The route calls requireTeacher(), then applyTeacherAction(teacher, body) from src/lib/learning/teacher-actions.ts.
// The acting teacher is ALWAYS taken from the server session; the request carries no teacher id.
export const TeacherActionRequestSchema = TeacherActionInputSchema;
export type TeacherActionRequest = z.infer<typeof TeacherActionRequestSchema>;
export const TeacherActionResponseSchema = z.object({
  /** The student's progress for the concept the action was about (the CURRENT concept). */
  progress: ConceptProgressSchema,
  /** Next concept in curriculum order after an approval; null for every other action and for the last concept. */
  nextProgress: ConceptProgressSchema.nullable(),
  /** True when nothing needed changing (for example a repeated approval). Nothing was duplicated or reset. */
  alreadyApplied: z.boolean(),
});
export type TeacherActionResponse = z.infer<typeof TeacherActionResponseSchema>;

export const TeacherActionErrorCodeSchema = z.enum([
  "forbidden", // not a logged-in teacher (HTTP 403)
  "invalid_input", // body failed validation (400)
  "not_found", // student, progress row or diagnosis does not exist for this target (404)
  "rule_violation", // understood but not allowed, e.g. approving without the override note (409)
  "not_implemented", // persistence not built yet (501)
  "internal", // saving failed; nothing was changed (500)
]);
export type TeacherActionErrorCode = z.infer<typeof TeacherActionErrorCodeSchema>;

export type TeacherActionResult =
  | { ok: true; data: TeacherActionResponse }
  | { ok: false; error: string; code: TeacherActionErrorCode };

export const StudentSummarySchema = z.object({
  studentId: z.string().uuid(),
  displayName: z.string(),
  currentConceptId: ConceptIdSchema,
  needsAttention: z.boolean(),
  statusLabel: z.string(), // e.g. "Working normally" / "Teacher attention needed"
});
export type StudentSummary = z.infer<typeof StudentSummarySchema>;

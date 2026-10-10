// SAFAL shared contracts, part 2: request/response shapes for server actions and routes.
// LEAD-OWNED. Teammates implement these; they do not change them without the lead.
import { z } from "zod";
import {
  AnswerInputSchema,
  ConceptIdSchema,
  ConceptProgressSchema,
  DiagnosisSchema,
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
  /** Right/wrong per question, never a number. */
  results: z.array(z.object({ questionId: z.string(), isCorrect: z.boolean() })),
  diagnoses: z.array(DiagnosisSchema),
  progress: ConceptProgressSchema,
  /** Present when the AI needs a short clarification instead of a guess. */
  followUpQuestion: z.string().nullable(),
});
export type SubmitAnswersResponse = z.infer<typeof SubmitAnswersResponseSchema>;

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

// POST /api/upload  (handwritten image -> private storage -> AI interpretation, for the student to preview)
// Sent as multipart/form-data with the fields in UploadFieldsSchema plus one file field named "file".
// The server stores the image at "<studentId>/<attemptId>-<questionId>-<timestamp>.<ext>" using the STUDENT'S OWN
// session (so the storage policy applies). When the answer is submitted, /api/answers reads the stored image again
// itself; it never trusts interpreted text sent by the browser.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const UploadFieldsSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string(),
});
export type UploadFields = z.infer<typeof UploadFieldsSchema>;
export const UploadResponseSchema = z.object({
  uploadPath: z.string(),
  interpretedText: z.string(),
  source: z.enum(["mock", "live"]),
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

// Teacher
export const TeacherActionRequestSchema = TeacherActionInputSchema;
export type TeacherActionRequest = z.infer<typeof TeacherActionRequestSchema>;
export const TeacherActionResponseSchema = z.object({ progress: ConceptProgressSchema });
export type TeacherActionResponse = z.infer<typeof TeacherActionResponseSchema>;

export const StudentSummarySchema = z.object({
  studentId: z.string().uuid(),
  displayName: z.string(),
  currentConceptId: ConceptIdSchema,
  needsAttention: z.boolean(),
  statusLabel: z.string(), // e.g. "Working normally" / "Teacher attention needed"
});
export type StudentSummary = z.infer<typeof StudentSummarySchema>;

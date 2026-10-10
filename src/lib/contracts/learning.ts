// SAFAL shared contracts, part 1: learning state, answers, diagnoses, support cycles.
// LEAD-OWNED. Change only via a pull request approved by the lead.
// Zod schemas are the single source of truth; TypeScript types are inferred from them.
import { z } from "zod";

export const ConceptIdSchema = z.enum(["C1", "C2", "C3", "C4"]);
export type ConceptId = z.infer<typeof ConceptIdSchema>;

/** Every AI-produced result says whether it was MOCK or LIVE. The UI must show this. */
export const AiSourceSchema = z.enum(["mock", "live"]);
export type AiSource = z.infer<typeof AiSourceSchema>;

export const MAX_SUPPORT_CYCLES = 2;

// ---- Learning state -------------------------------------------------------
export const LearningStateSchema = z.enum([
  "lesson",
  "doubts",
  "microtest",
  "analysis",
  "support",
  "reassessment",
  "passed",
  "teacher_flagged",
]);
export type LearningState = z.infer<typeof LearningStateSchema>;

export const ConceptProgressSchema = z.object({
  studentId: z.string().uuid(),
  conceptId: ConceptIdSchema,
  state: LearningStateSchema,
  supportCyclesUsed: z.number().int().min(0).max(MAX_SUPPORT_CYCLES),
  teacherFlagged: z.boolean(),
  /** Only the teacher can set this. Passing a test never moves a student on by itself. */
  teacherClearedToNext: z.boolean(),
});
export type ConceptProgress = z.infer<typeof ConceptProgressSchema>;

// ---- Questions and answers -----------------------------------------------
/** What a student sees. The answer key is never part of this type. */
export const QuestionSchema = z.object({
  id: z.string(),
  conceptId: ConceptIdSchema,
  prompt: z.string(),
});
export type Question = z.infer<typeof QuestionSchema>;

/** Server-only. Never send to a student's browser. */
export const QuestionKeySchema = z.object({
  questionId: z.string(),
  expectedIdea: z.string(),
  commonMisconceptions: z.array(z.string()),
});
export type QuestionKey = z.infer<typeof QuestionKeySchema>;

// ---- Handwriting ----------------------------------------------------------
/**
 * What the AI managed to do with an uploaded handwritten image.
 *  - read:     the provider really looked at the image and produced a draft transcription.
 *  - unclear:  it looked but could not read it reliably (draftText may be partial or null).
 *  - not_read: nothing was read. This is what the MOCK provider always returns: it must never pretend.
 * In every case the student confirms or corrects the text before anything is diagnosed.
 */
export const HandwritingStatusSchema = z.enum(["read", "unclear", "not_read"]);
export type HandwritingStatus = z.infer<typeof HandwritingStatusSchema>;

export const HandwritingReadingSchema = z
  .object({
    status: HandwritingStatusSchema,
    /** A DRAFT for the student to confirm or correct. Never diagnosed as it stands. */
    draftText: z.string().nullable(),
    source: AiSourceSchema,
  })
  .refine((r) => r.status !== "not_read" || r.draftText === null, {
    message: "A reading that was not made cannot carry text.",
  })
  .refine((r) => r.status !== "read" || (r.draftText !== null && r.draftText.trim().length > 0), {
    message: "A successful reading must carry text.",
  });
export type HandwritingReading = z.infer<typeof HandwritingReadingSchema>;

/**
 * An answer is typed text, an uploaded handwritten image, or both.
 * An uploaded image must come with `confirmedText`: the student's own confirmed or corrected reading of it.
 * The server diagnoses typedText and confirmedText. It never diagnoses a raw AI reading.
 */
export const AnswerInputSchema = z
  .object({
    questionId: z.string(),
    typedText: z.string().trim().min(1).max(4000).optional(),
    /** Path inside the private 'student-work' bucket, e.g. "<studentId>/<file>.jpg". */
    uploadPath: z.string().min(1).optional(),
    /** The student's confirmed or corrected text for the uploaded image. Required with uploadPath. */
    confirmedText: z.string().trim().min(1).max(4000).optional(),
  })
  .refine((a) => a.typedText !== undefined || a.uploadPath !== undefined, {
    message: "Provide typed text, an uploaded image, or both.",
  })
  .refine((a) => (a.uploadPath === undefined) === (a.confirmedText === undefined), {
    message: "A handwritten upload needs the student's confirmed text, and confirmed text needs an upload.",
  });
export type AnswerInput = z.infer<typeof AnswerInputSchema>;

// ---- Diagnosis ------------------------------------------------------------
export const NextActionSchema = z.enum(["follow_up_question", "targeted_support", "none"]);
export type NextAction = z.infer<typeof NextActionSchema>;

/** Output of the AI for one answer. No numerical score exists anywhere. */
export const DiagnosisSchema = z.object({
  conceptId: ConceptIdSchema,
  questionId: z.string(),
  isCorrect: z.boolean(),
  /** False can happen even when isCorrect is true: right answer, faulty or lucky reasoning. */
  reasoningSound: z.boolean(),
  misconception: z.string().nullable(),
  evidence: z.string(),
  nextAction: NextActionSchema,
  /** Set when reasoning is unclear: ask a short question instead of guessing the cause. */
  followUpQuestion: z.string().nullable(),
  source: AiSourceSchema,
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

// ---- Support and reassessment --------------------------------------------
export const SupportPlanSchema = z.object({
  conceptId: ConceptIdSchema,
  cycleNumber: z.union([z.literal(1), z.literal(2)]),
  targetMisconception: z.string(),
  explanation: z.string(),
  guidingQuestion: z.string(),
  practiceTask: z.string(),
  /** Ids of teacher-approved resources only. */
  resourceIds: z.array(z.string()),
  source: AiSourceSchema,
});
export type SupportPlan = z.infer<typeof SupportPlanSchema>;

export const GeneratedQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  /** Hidden from the student; used by the diagnosis step. */
  expectedIdea: z.string(),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const ReassessmentSchema = z.object({
  conceptId: ConceptIdSchema,
  cycleNumber: z.union([z.literal(1), z.literal(2)]),
  questions: z.array(GeneratedQuestionSchema).min(1),
  source: AiSourceSchema,
});
export type Reassessment = z.infer<typeof ReassessmentSchema>;

export const SupportOutcomeSchema = z.enum(["pending", "succeeded", "struggled"]);
export type SupportOutcome = z.infer<typeof SupportOutcomeSchema>;

// ---- Clarification and attempt outcome -----------------------------------
/** A short clarification is asked at most this often per question. It is never a failed cycle. */
export const MAX_CLARIFICATIONS_PER_QUESTION = 1;

/** One clarification the student still has to answer. */
export const FollowUpSchema = z.object({ questionId: z.string(), question: z.string() });
export type FollowUp = z.infer<typeof FollowUpSchema>;

/**
 * What one sitting (micro-test or reassessment) amounts to once every answer is diagnosed.
 *  - awaiting_clarification: a follow-up is still open. No verdict, no cycle used.
 *  - succeeded:              everything correct with sound reasoning. Awaits teacher approval; never moves on by itself.
 *  - struggled:              clear evidence of a gap. Uses up one support/reassessment cycle.
 *  - unclear_needs_teacher:  still unclear after the allowed clarification. NOT a failure: goes to the teacher.
 */
export const AttemptOutcomeSchema = z.enum([
  "awaiting_clarification",
  "succeeded",
  "struggled",
  "unclear_needs_teacher",
]);
export type AttemptOutcome = z.infer<typeof AttemptOutcomeSchema>;

// ---- Homework -------------------------------------------------------------
export const HomeworkItemSchema = z.object({
  id: z.string(),
  conceptId: ConceptIdSchema,
  prompt: z.string(),
});
export type HomeworkItem = z.infer<typeof HomeworkItemSchema>;

export const HomeworkSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  forDate: z.string(), // YYYY-MM-DD
  items: z.array(HomeworkItemSchema).min(1),
  source: AiSourceSchema,
  submittedAt: z.string().nullable(),
});
export type Homework = z.infer<typeof HomeworkSchema>;

// ---- Teacher actions ------------------------------------------------------
export const TeacherActionKindSchema = z.enum([
  "approve_next_concept",
  "override_diagnosis",
  "assign_support",
  "clear_flag",
  "note",
]);
export type TeacherActionKind = z.infer<typeof TeacherActionKindSchema>;

const TeacherNoteSchema = z.string().trim().min(1).max(2000);
const teacherTarget = { studentId: z.string().uuid(), conceptId: ConceptIdSchema };

/**
 * Teacher approval to move on. Passing a test never does this by itself.
 * If the student's state is not 'passed', the teacher must set overrideUnderstanding AND write a note.
 * The student's diagnosis is never rewritten as successful by an approval.
 */
export const ApproveNextConceptInputSchema = z
  .object({
    ...teacherTarget,
    action: z.literal("approve_next_concept"),
    overrideUnderstanding: z.boolean().optional(),
    note: TeacherNoteSchema.optional(),
  })
  .refine((a) => a.overrideUnderstanding !== true || a.note !== undefined, {
    message: "A note is required when approving a student who has not demonstrated understanding.",
    path: ["note"],
  });

/** What the teacher says the diagnosis should have been. The original AI diagnosis is kept untouched. */
export const DiagnosisReplacementSchema = z
  .object({
    isCorrect: z.boolean(),
    reasoningSound: z.boolean(),
    misconception: z.string().trim().min(1).max(500).nullable(),
  })
  .refine((r) => !(r.isCorrect && r.reasoningSound) || r.misconception === null, {
    message: "A correct answer with sound reasoning cannot also name a misconception.",
    path: ["misconception"],
  });
export type DiagnosisReplacement = z.infer<typeof DiagnosisReplacementSchema>;

export const OverrideDiagnosisInputSchema = z.object({
  ...teacherTarget,
  action: z.literal("override_diagnosis"),
  diagnosisId: z.string().uuid(),
  replacement: DiagnosisReplacementSchema,
  /** Required: why the teacher disagrees with the AI. */
  note: TeacherNoteSchema,
});

/** Teacher-written support, shown to the student beside any automated support. */
export const TeacherSupportContentSchema = z.object({
  explanation: z.string().trim().min(1).max(2000),
  guidingQuestion: z.string().trim().min(1).max(1000).nullable(),
  practiceTask: z.string().trim().min(1).max(1000).nullable(),
  /** Ids of teacher-approved resources of this concept only. May be empty. */
  resourceIds: z.array(z.string()).max(5),
});
export type TeacherSupportContent = z.infer<typeof TeacherSupportContentSchema>;

export const AssignSupportInputSchema = z.object({
  ...teacherTarget,
  action: z.literal("assign_support"),
  support: TeacherSupportContentSchema,
  note: TeacherNoteSchema.optional(),
});

export const ClearFlagInputSchema = z.object({
  ...teacherTarget,
  action: z.literal("clear_flag"),
  note: TeacherNoteSchema.optional(),
});

export const AddNoteInputSchema = z.object({
  ...teacherTarget,
  action: z.literal("note"),
  note: TeacherNoteSchema,
});

export const TeacherActionInputSchema = z.discriminatedUnion("action", [
  ApproveNextConceptInputSchema,
  OverrideDiagnosisInputSchema,
  AssignSupportInputSchema,
  ClearFlagInputSchema,
  AddNoteInputSchema,
]);
export type TeacherActionInput = z.infer<typeof TeacherActionInputSchema>;

// What the server records in teacher_actions.payload (jsonb), by action. Read with the user's own session.
// The teacher_id column is the authenticated teacher; it is never taken from the request.
export const ApproveNextPayloadSchema = z.object({
  /** True only when the student's state was not 'passed' at approval time. */
  overrideUnderstanding: z.boolean(),
  stateAtApproval: LearningStateSchema,
  /** Next concept in curriculum order (concepts.position), or null when this was the last one. */
  nextConceptId: ConceptIdSchema.nullable(),
  createdNextProgress: z.boolean(),
});
export type ApproveNextPayload = z.infer<typeof ApproveNextPayloadSchema>;

export const OverrideDiagnosisPayloadSchema = z.object({
  diagnosisId: z.string().uuid(),
  /** Snapshot of what the AI said. The diagnoses row itself is never edited. */
  original: z.object({
    isCorrect: z.boolean(),
    reasoningSound: z.boolean(),
    misconception: z.string().nullable(),
    nextAction: NextActionSchema,
    source: AiSourceSchema,
  }),
  replacement: DiagnosisReplacementSchema,
  changedFields: z.array(z.enum(["isCorrect", "reasoningSound", "misconception"])).min(1),
});
export type OverrideDiagnosisPayload = z.infer<typeof OverrideDiagnosisPayloadSchema>;

export const AssignSupportPayloadSchema = z.object({ support: TeacherSupportContentSchema });
export type AssignSupportPayload = z.infer<typeof AssignSupportPayloadSchema>;

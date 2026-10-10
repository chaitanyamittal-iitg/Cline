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

/** An answer is typed text, an uploaded image path, or both. */
export const AnswerInputSchema = z
  .object({
    questionId: z.string(),
    typedText: z.string().trim().min(1).max(4000).optional(),
    /** Path inside the private 'student-work' bucket, e.g. "<studentId>/<file>.jpg". */
    uploadPath: z.string().min(1).optional(),
  })
  .refine((a) => a.typedText !== undefined || a.uploadPath !== undefined, {
    message: "Provide typed text, an uploaded image, or both.",
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

export const TeacherActionInputSchema = z.object({
  studentId: z.string().uuid(),
  conceptId: ConceptIdSchema,
  action: TeacherActionKindSchema,
  note: z.string().max(2000).optional(),
});
export type TeacherActionInput = z.infer<typeof TeacherActionInputSchema>;

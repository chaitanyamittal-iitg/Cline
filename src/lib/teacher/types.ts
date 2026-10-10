// Row shapes and view models for the read-only teacher pages. TEACHER-OWNED (feat/teacher).
// Row schemas mirror the real columns in supabase/migrations/0001-0005 and are used to validate query results,
// so an unexpected shape is reported as a failed section instead of being rendered blindly.
// No server-only imports here: this file is pure and safe to unit-test.
import { z } from "zod";

export const ProfileRowSchema = z.object({
  id: z.string(),
  role: z.string(),
  display_name: z.string(),
  class_label: z.string().nullable(),
});
export type ProfileRow = z.infer<typeof ProfileRowSchema>;

export const ConceptRowSchema = z.object({
  id: z.string(),
  position: z.number(),
  title: z.string(),
});
export type ConceptRow = z.infer<typeof ConceptRowSchema>;

export const ProgressRowSchema = z.object({
  student_id: z.string(),
  concept_id: z.string(),
  state: z.string(),
  support_cycles_used: z.number(),
  teacher_flagged: z.boolean(),
  teacher_cleared_to_next: z.boolean(),
});
export type ProgressRow = z.infer<typeof ProgressRowSchema>;

export const AttemptRowSchema = z.object({
  id: z.string(),
  concept_id: z.string(),
  kind: z.string(),
  cycle: z.number(),
  questions: z.unknown(), // jsonb [{id, prompt}]; parsed defensively in linking.ts
  ai_source: z.string().nullable(),
  created_at: z.string(),
});
export type AttemptRow = z.infer<typeof AttemptRowSchema>;

export const AnswerRowSchema = z.object({
  id: z.string(),
  attempt_id: z.string(),
  question_id: z.string(),
  typed_text: z.string().nullable(),
  upload_path: z.string().nullable(),
  interpreted_text: z.string().nullable(),
  interpreted_by: z.string().nullable(),
  is_correct: z.boolean().nullable(),
  created_at: z.string(),
});
export type AnswerRow = z.infer<typeof AnswerRowSchema>;

export const QuestionRowSchema = z.object({
  id: z.string(),
  concept_id: z.string(),
  prompt: z.string(),
});
export type QuestionRow = z.infer<typeof QuestionRowSchema>;

export const DiagnosisRowSchema = z.object({
  id: z.string(),
  answer_id: z.string().nullable(),
  concept_id: z.string(),
  is_correct: z.boolean(),
  reasoning_sound: z.boolean(),
  misconception: z.string().nullable(),
  evidence: z.string(),
  next_action: z.string(),
  follow_up_question: z.string().nullable(),
  ai_source: z.string(),
  created_at: z.string(),
});
export type DiagnosisRow = z.infer<typeof DiagnosisRowSchema>;

export const SupportCycleRowSchema = z.object({
  id: z.string(),
  concept_id: z.string(),
  cycle_number: z.number(),
  diagnosis_id: z.string().nullable(),
  support: z.unknown(), // jsonb; displayed defensively by describeSupport()
  reassessment_attempt_id: z.string().nullable(),
  outcome: z.string(),
  ai_source: z.string(),
  created_at: z.string(),
});
export type SupportCycleRow = z.infer<typeof SupportCycleRowSchema>;

// ---- Result wrappers ------------------------------------------------------
/** A section either loaded or failed. A failure is never shown as "no data". */
export type SectionResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type ImageResult =
  | { ok: true; url: string }
  | { ok: false; reason: "outside_student_folder" | "signing_failed" };

// ---- Plain view models shared by queries and components --------------------
export interface StudentIdentity {
  id: string;
  displayName: string;
  classLabel: string | null;
}

export interface ConceptProgressView {
  conceptId: string;
  conceptTitle: string;
  position: number;
  state: string;
  supportCyclesUsed: number;
  teacherFlagged: boolean;
  teacherClearedToNext: boolean;
}

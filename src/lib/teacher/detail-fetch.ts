// Raw read-only queries for one student's detail page. TEACHER-OWNED. Server only.
// Every query is scoped with .eq("student_id", <selected student>) and runs with the teacher's own session (RLS applies).
// Only the columns the page displays are selected. No admin client and no writes.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRows } from "./fetch";
import {
  AnswerRowSchema,
  AttemptRowSchema,
  ConceptRowSchema,
  DiagnosisRowSchema,
  ProgressRowSchema,
  QuestionRowSchema,
  ResourceRowSchema,
  SupportCycleRowSchema,
} from "./types";

export function fetchStudentRecords(sb: SupabaseClient, studentId: string) {
  return Promise.all([
    fetchRows("Concept progress", ProgressRowSchema, () =>
      sb
        .from("concept_progress")
        .select("student_id, concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next")
        .eq("student_id", studentId),
    ),
    fetchRows("Concept titles", ConceptRowSchema, () => sb.from("concepts").select("id, position, title").order("position")),
    fetchRows("Attempts", AttemptRowSchema, () =>
      sb
        .from("attempts")
        .select("id, concept_id, kind, cycle, questions, ai_source, created_at")
        .eq("student_id", studentId)
        .order("created_at"),
    ),
    fetchRows("Answers", AnswerRowSchema, () =>
      sb
        .from("answers")
        .select(
          "id, attempt_id, question_id, typed_text, upload_path, interpreted_text, interpreted_by, is_correct, created_at, kind, clarifies_answer_id, confirmed_text, reading_status",
        )
        .eq("student_id", studentId)
        .order("created_at"),
    ),
    fetchRows("Diagnoses", DiagnosisRowSchema, () =>
      sb
        .from("diagnoses")
        .select(
          "id, answer_id, concept_id, is_correct, reasoning_sound, misconception, evidence, next_action, follow_up_question, ai_source, created_at",
        )
        .eq("student_id", studentId)
        .order("created_at"),
    ),
    fetchRows("Support cycles", SupportCycleRowSchema, () =>
      sb
        .from("support_cycles")
        .select("id, concept_id, cycle_number, diagnosis_id, support, reassessment_attempt_id, outcome, ai_source, created_at")
        .eq("student_id", studentId)
        .order("cycle_number"),
    ),
  ] as const);
}

/** Approved resources only (the contract allows only approved ones in assigned support). Real ids for the support form. */
export function fetchApprovedResources(sb: SupabaseClient) {
  return fetchRows("Approved resources", ResourceRowSchema, () =>
    sb.from("resources").select("id, concept_id, kind, title").eq("approved", true).order("position"),
  );
}

/** Question-bank prompts, only for the ids the stored work mentions. Used when an attempt did not store a prompt. */
export function fetchQuestionPrompts(sb: SupabaseClient, questionIds: string[]) {
  return fetchRows("Question prompts", QuestionRowSchema, () =>
    sb.from("questions").select("id, concept_id, prompt").in("id", questionIds),
  );
}

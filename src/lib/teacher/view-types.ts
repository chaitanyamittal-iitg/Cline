// View models built from stored rows by linking.ts and support.ts. TEACHER-OWNED. Pure types only.
import type { AnswerRow, AttemptRow, DiagnosisRow, SupportCycleRow } from "./types";

export interface AnswerView {
  answer: AnswerRow;
  /** Diagnoses whose answer_id equals this answer's id (a real foreign key), nothing else. */
  diagnoses: DiagnosisRow[];
}

export interface QuestionItem {
  questionId: string;
  prompt: string | null;
  /** Where the prompt text came from. null = no stored prompt could be found. */
  promptOrigin: "attempt" | "question_bank" | null;
  answers: AnswerView[];
}

export interface AttemptView {
  attempt: AttemptRow;
  items: QuestionItem[];
  /** The support cycle whose reassessment_attempt_id points at this attempt, if any. */
  supportCycle: SupportCycleRow | null;
}

export type UnlinkedReason = "no_answer_link" | "answer_not_found" | "answers_unavailable";

export interface UnlinkedDiagnosis {
  diagnosis: DiagnosisRow;
  reason: UnlinkedReason;
}

export type LinkedLookup<T> =
  | { state: "none" } // the cycle stores no link
  | { state: "unavailable" } // a link is stored but the record was not loaded or is not readable
  | { state: "found"; value: T };

export interface SupportDisplay {
  fields: { label: string; value: string }[];
  resourceIds: string[];
  /** Stored content this view does not recognise, as formatted JSON. null when nothing is left over. */
  other: string | null;
}

export interface SupportCycleView {
  cycle: SupportCycleRow;
  display: SupportDisplay;
  triggerDiagnosis: LinkedLookup<DiagnosisRow>;
  reassessmentAttempt: LinkedLookup<AttemptRow>;
}

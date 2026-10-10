// Real, selectable records for the action forms. TEACHER-OWNED. Pure (unit-tested in action-inputs.test.ts).
// Diagnosis ids and resource ids come only from rows the teacher's session actually read: none are invented.
import { byCreatedThenId } from "./linking";
import type { DiagnosisRow, ResourceRow } from "./types";

export interface DiagnosisOption {
  id: string;
  conceptId: string;
  isCorrect: boolean;
  reasoningSound: boolean;
  misconception: string | null;
  nextAction: string;
  /** Recorded ai_source, shown as a label next to the original diagnosis. */
  source: string;
  createdAt: string;
}

export interface ResourceOption {
  id: string;
  conceptId: string;
  kind: string;
  title: string;
}

export function toDiagnosisOptions(rows: DiagnosisRow[]): DiagnosisOption[] {
  return [...rows].sort(byCreatedThenId).map((row) => ({
    id: row.id,
    conceptId: row.concept_id,
    isCorrect: row.is_correct,
    reasoningSound: row.reasoning_sound,
    misconception: row.misconception,
    nextAction: row.next_action,
    source: row.ai_source,
    createdAt: row.created_at,
  }));
}

export function toResourceOptions(rows: ResourceRow[]): ResourceOption[] {
  return rows.map((row) => ({ id: row.id, conceptId: row.concept_id, kind: row.kind, title: row.title }));
}

// Row builders for unit tests ONLY (imported by *.test.ts). TEACHER-OWNED. Plain in-memory values: nothing here is
// stored, seeded or shown in the app, and it imports no server code.
import type { AnswerRow, AttemptRow, DiagnosisRow } from "./types";

export const testAttempt: AttemptRow = {
  id: "at1",
  concept_id: "C3",
  kind: "microtest",
  cycle: 0,
  questions: [{ id: "C3-Q1", prompt: "Will the bulb light?" }, { id: "C3-Q2", prompt: "Why?" }],
  ai_source: null,
  created_at: "2026-10-10T08:00:00Z",
};

export const testAnswer = (over: Partial<AnswerRow>): AnswerRow => ({
  id: "an1",
  attempt_id: "at1",
  question_id: "C3-Q1",
  typed_text: "it depends",
  upload_path: null,
  interpreted_text: null,
  interpreted_by: null,
  is_correct: null,
  created_at: "2026-10-10T08:05:00Z",
  kind: "original",
  clarifies_answer_id: null,
  confirmed_text: null,
  reading_status: null,
  ...over,
});

export const testDiagnosis = (over: Partial<DiagnosisRow>): DiagnosisRow => ({
  id: "d1",
  answer_id: "an1",
  concept_id: "C3",
  is_correct: false,
  reasoning_sound: false,
  misconception: "m",
  evidence: "e",
  next_action: "follow_up_question",
  follow_up_question: "What do you mean?",
  ai_source: "mock",
  created_at: "2026-10-10T08:06:00Z",
  ...over,
});

export const emptyInputs = { attempts: [testAttempt], diagnoses: [], questionBank: [], supportCycles: [] };

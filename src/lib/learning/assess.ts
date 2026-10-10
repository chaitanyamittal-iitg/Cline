// Pure: turns SAVED answer and diagnosis rows into the student-facing result of one sitting. No database, no network.
// The same function answers a first submission, a safe retry and a follow-up, so every route reports the sitting the
// same way and a page reload shows exactly what was saved. Precedence comes from ./rules.ts (evaluateAttempt).
import {
  DiagnosisSchema,
  SubmitAnswersResponseSchema,
  type AttemptOutcome,
  type ConceptProgress,
  type Diagnosis,
  type FollowUp,
  type SubmitAnswersResponse,
} from "@/lib/contracts";
import { evaluateAttempt, type JudgedAnswer } from "./rules";

export interface SavedAnswerRow {
  id: string;
  question_id: string;
  kind: string;
  clarifies_answer_id: string | null;
  typed_text: string | null;
  confirmed_text: string | null;
  upload_path: string | null;
}

export interface SavedDiagnosisRow {
  answer_id: string | null;
  concept_id: string;
  is_correct: boolean;
  reasoning_sound: boolean;
  misconception: string | null;
  evidence: string;
  next_action: string;
  follow_up_question: string | null;
  ai_source: string;
  created_at: string;
}

export const FALLBACK_FOLLOW_UP = "Can you explain your thinking in a sentence or two?";

/** The AI could not tell and asked a short question instead of guessing. */
export function isUnclearDiagnosis(d: Pick<Diagnosis, "isCorrect" | "reasoningSound" | "nextAction">): boolean {
  return !(d.isCorrect && d.reasoningSound) && d.nextAction === "follow_up_question";
}

export function rowToDiagnosis(row: SavedDiagnosisRow, questionId: string): Diagnosis | null {
  const parsed = DiagnosisSchema.safeParse({
    conceptId: row.concept_id,
    questionId,
    isCorrect: row.is_correct,
    reasoningSound: row.reasoning_sound,
    misconception: row.misconception,
    evidence: row.evidence,
    nextAction: row.next_action,
    followUpQuestion: row.follow_up_question,
    source: row.ai_source,
  });
  return parsed.success ? parsed.data : null;
}

export interface Assessment {
  results: { questionId: string; isCorrect: boolean | null }[];
  diagnoses: Diagnosis[];
  followUps: FollowUp[];
  /** The per-question facts the outcome was judged from (used to re-judge a sitting after a clarification). */
  judged: JudgedAnswer[];
  /** null when the sitting is incomplete or a saved diagnosis is unreadable: say nothing rather than guess. */
  outcome: AttemptOutcome | null;
}

export function assessAttempt(
  questionOrder: readonly string[],
  answers: readonly SavedAnswerRow[],
  diagnoses: readonly SavedDiagnosisRow[],
): Assessment {
  const latest = new Map<string, SavedDiagnosisRow>();
  for (const d of diagnoses) {
    if (!d.answer_id) continue;
    const current = latest.get(d.answer_id);
    if (!current || d.created_at > current.created_at) latest.set(d.answer_id, d);
  }

  const results: Assessment["results"] = [];
  const parsedDiagnoses: Diagnosis[] = [];
  const followUps: FollowUp[] = [];
  const judged: JudgedAnswer[] = [];
  let complete = true;

  for (const questionId of questionOrder) {
    const original = answers.find((a) => a.kind === "original" && a.question_id === questionId);
    if (!original) {
      complete = false;
      continue;
    }
    const clarification = answers.find((a) => a.kind === "clarification" && a.clarifies_answer_id === original.id);
    // A clarified question is judged on the fresh diagnosis stored against the clarification row.
    const row = (clarification && latest.get(clarification.id)) ?? latest.get(original.id);
    const diagnosis = row ? rowToDiagnosis(row, questionId) : null;
    if (!diagnosis) {
      complete = false;
      results.push({ questionId, isCorrect: null });
      continue;
    }
    parsedDiagnoses.push(diagnosis);
    const unclear = isUnclearDiagnosis(diagnosis);
    const open = unclear && !clarification;
    results.push({ questionId, isCorrect: open ? null : diagnosis.isCorrect });
    if (open) followUps.push({ questionId, question: diagnosis.followUpQuestion ?? FALLBACK_FOLLOW_UP });
    judged.push({
      questionId,
      isCorrect: diagnosis.isCorrect,
      reasoningSound: diagnosis.reasoningSound,
      nextAction: diagnosis.nextAction,
      clarified: clarification !== undefined,
    });
  }

  return {
    results,
    diagnoses: parsedDiagnoses,
    followUps,
    judged,
    outcome: complete && judged.length > 0 ? evaluateAttempt(judged) : null,
  };
}

export function toSubmitResponse(assessment: Assessment, progress: ConceptProgress): SubmitAnswersResponse | null {
  if (!assessment.outcome) return null;
  const parsed = SubmitAnswersResponseSchema.safeParse({
    results: assessment.results,
    diagnoses: assessment.diagnoses,
    progress,
    followUps: assessment.followUps,
    attemptOutcome: assessment.outcome,
  });
  return parsed.success ? parsed.data : null;
}

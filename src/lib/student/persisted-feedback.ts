// Rebuilds the feedback a student saw, from rows the server saved. Pure: no database, no network.
// Open follow-ups are originals whose diagnosis asks a question and that have no clarification row yet.
// The attempt outcome uses the same precedence as the server (src/lib/learning/rules.ts evaluateAttempt):
//   open clarification > clear gap > still unclear after clarification > success.
// If a diagnosis is missing or unreadable we show NO verdict for that question rather than guessing.
import { DiagnosisSchema, type AttemptOutcome, type Diagnosis, type FollowUp } from "@/lib/contracts";
import type { FeedbackModel, YourAnswer } from "./feedback-model";
import { isUnclear } from "./feedback-text";
import type { PromptQuestion } from "./journey-types";

export interface PersistedAnswerRow {
  id: string;
  question_id: string;
  kind: string;
  clarifies_answer_id: string | null;
  typed_text: string | null;
  confirmed_text: string | null;
  upload_path: string | null;
}

export interface PersistedDiagnosisRow {
  answer_id: string;
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

interface Judged {
  known: boolean;
  sound: boolean;
  unclear: boolean;
  clarified: boolean;
}

const UNKNOWN: Judged = { known: false, sound: false, unclear: false, clarified: false };

/** Returns null when no original answer has been saved for this sitting yet. */
export function buildPersistedFeedback(
  questions: PromptQuestion[],
  answers: PersistedAnswerRow[],
  diagnoses: PersistedDiagnosisRow[],
): FeedbackModel | null {
  const originals = answers.filter((a) => a.kind === "original");
  if (originals.length === 0) return null;

  const clarificationByOriginal = new Map<string, PersistedAnswerRow>();
  for (const a of answers) {
    if (a.kind === "clarification" && a.clarifies_answer_id) clarificationByOriginal.set(a.clarifies_answer_id, a);
  }

  // Latest diagnosis per answer row. A clarified question is diagnosed again against the clarification row.
  const latestByAnswer = new Map<string, PersistedDiagnosisRow>();
  for (const d of diagnoses) {
    const current = latestByAnswer.get(d.answer_id);
    if (!current || d.created_at > current.created_at) latestByAnswer.set(d.answer_id, d);
  }

  const order = new Map(questions.map((q, i) => [q.id, i]));
  const sorted = [...originals].sort((a, b) => (order.get(a.question_id) ?? 999) - (order.get(b.question_id) ?? 999));

  const results: { questionId: string; isCorrect: boolean | null }[] = [];
  const parsedDiagnoses: Diagnosis[] = [];
  const followUps: FollowUp[] = [];
  const yourAnswers: YourAnswer[] = [];
  const judged: Judged[] = [];

  for (const original of sorted) {
    const clarification = clarificationByOriginal.get(original.id) ?? null;
    yourAnswers.push({
      questionId: original.question_id,
      text: original.typed_text ?? original.confirmed_text ?? "",
      fromPhoto: original.upload_path !== null,
      clarification: clarification ? (clarification.typed_text ?? clarification.confirmed_text ?? null) : null,
    });

    const row = latestByAnswer.get(clarification?.id ?? "") ?? latestByAnswer.get(original.id);
    const parsed = row
      ? DiagnosisSchema.safeParse({
          conceptId: row.concept_id,
          questionId: original.question_id,
          isCorrect: row.is_correct,
          reasoningSound: row.reasoning_sound,
          misconception: row.misconception,
          evidence: row.evidence,
          nextAction: row.next_action,
          followUpQuestion: row.follow_up_question,
          source: row.ai_source,
        })
      : null;

    if (!parsed || !parsed.success) {
      results.push({ questionId: original.question_id, isCorrect: null });
      judged.push(UNKNOWN);
      continue;
    }

    const d = parsed.data;
    parsedDiagnoses.push(d);
    const unclear = isUnclear(d);
    const open = unclear && clarification === null;
    results.push({ questionId: original.question_id, isCorrect: open ? null : d.isCorrect });
    if (open && d.followUpQuestion) followUps.push({ questionId: original.question_id, question: d.followUpQuestion });
    judged.push({ known: true, sound: d.isCorrect && d.reasoningSound, unclear, clarified: clarification !== null });
  }

  let attemptOutcome: AttemptOutcome | null = null;
  if (judged.every((j) => j.known)) {
    if (judged.some((j) => j.unclear && !j.clarified)) attemptOutcome = "awaiting_clarification";
    else if (judged.some((j) => !j.sound && !j.unclear)) attemptOutcome = "struggled";
    else if (judged.some((j) => j.unclear)) attemptOutcome = "unclear_needs_teacher";
    else attemptOutcome = "succeeded";
  }

  return { results, diagnoses: parsedDiagnoses, followUps, attemptOutcome, yourAnswers };
}

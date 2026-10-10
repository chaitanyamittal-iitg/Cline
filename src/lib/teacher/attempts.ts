// Attempt/answer/diagnosis linking. TEACHER-OWNED. Pure (unit-tested in linking.test.ts).
// Uses only real foreign keys: answers.attempt_id, diagnoses.answer_id, support_cycles.reassessment_attempt_id.
import { byCreatedThenId, parseAttemptQuestions } from "./linking";
import type { AnswerRow, AttemptRow, DiagnosisRow, QuestionRow, SupportCycleRow } from "./types";
import type { AnswerView, AttemptView, QuestionItem, UnlinkedDiagnosis } from "./view-types";

export function buildAttemptViews(input: {
  attempts: AttemptRow[];
  answers: AnswerRow[];
  diagnoses: DiagnosisRow[];
  questionBank: QuestionRow[];
  supportCycles: SupportCycleRow[];
}): { attempts: AttemptView[]; orphanAnswers: AnswerView[] } {
  const bank = new Map(input.questionBank.map((q) => [q.id, q.prompt]));
  const attemptIds = new Set(input.attempts.map((a) => a.id));

  const diagnosesByAnswer = new Map<string, DiagnosisRow[]>();
  for (const diagnosis of [...input.diagnoses].sort(byCreatedThenId)) {
    if (diagnosis.answer_id === null) continue;
    const list = diagnosesByAnswer.get(diagnosis.answer_id) ?? [];
    list.push(diagnosis);
    diagnosesByAnswer.set(diagnosis.answer_id, list);
  }
  const toAnswerView = (answer: AnswerRow): AnswerView => ({
    answer,
    diagnoses: diagnosesByAnswer.get(answer.id) ?? [],
  });

  const answersByAttempt = new Map<string, AnswerRow[]>();
  const orphans: AnswerRow[] = [];
  for (const answer of [...input.answers].sort(byCreatedThenId)) {
    if (!attemptIds.has(answer.attempt_id)) {
      orphans.push(answer);
      continue;
    }
    const list = answersByAttempt.get(answer.attempt_id) ?? [];
    list.push(answer);
    answersByAttempt.set(answer.attempt_id, list);
  }

  const cycleByAttempt = new Map<string, SupportCycleRow>();
  for (const cycle of input.supportCycles) {
    if (cycle.reassessment_attempt_id !== null) cycleByAttempt.set(cycle.reassessment_attempt_id, cycle);
  }

  const attempts = [...input.attempts].sort(byCreatedThenId).map((attempt): AttemptView => {
    const answers = answersByAttempt.get(attempt.id) ?? [];
    const items: QuestionItem[] = [];
    const seen = new Set<string>();
    const pushItem = (questionId: string, storedPrompt: string | null) => {
      if (seen.has(questionId)) return;
      seen.add(questionId);
      const bankPrompt = bank.get(questionId) ?? null;
      items.push({
        questionId,
        prompt: storedPrompt ?? bankPrompt,
        promptOrigin: storedPrompt !== null ? "attempt" : bankPrompt !== null ? "question_bank" : null,
        answers: answers.filter((a) => a.question_id === questionId).map(toAnswerView),
      });
    };
    for (const q of parseAttemptQuestions(attempt.questions)) pushItem(q.id, q.prompt);
    // An answer to a question the attempt does not list is still shown, never dropped.
    for (const answer of answers) pushItem(answer.question_id, null);
    return { attempt, items, supportCycle: cycleByAttempt.get(attempt.id) ?? null };
  });

  return { attempts, orphanAnswers: orphans.map(toAnswerView) };
}

/** Diagnoses with no verified link to a shown answer. They are listed at concept level (diagnoses.concept_id). */
export function findUnlinkedDiagnoses(diagnoses: DiagnosisRow[], answers: AnswerRow[] | null): UnlinkedDiagnosis[] {
  const answerIds = answers ? new Set(answers.map((a) => a.id)) : null;
  const out: UnlinkedDiagnosis[] = [];
  for (const diagnosis of [...diagnoses].sort(byCreatedThenId)) {
    if (diagnosis.answer_id === null) out.push({ diagnosis, reason: "no_answer_link" });
    else if (answerIds === null) out.push({ diagnosis, reason: "answers_unavailable" });
    else if (!answerIds.has(diagnosis.answer_id)) out.push({ diagnosis, reason: "answer_not_found" });
  }
  return out;
}

// Pure decisions for saving one sitting. No database, no network: safe to unit-test.
// It only COMBINES the rules in ./rules.ts (outcome of a sitting, state after it, two-cycle cap); it adds none.
import type { AttemptOutcome, ConceptProgress, Diagnosis, SupportOutcome } from "@/lib/contracts";
import { isUnclearDiagnosis } from "./assess";
import { evaluateAttempt, stateAfterAttempt, type JudgedAnswer, type SittingKind } from "./rules";

export interface SaveDecision {
  outcome: AttemptOutcome;
  newState: ConceptProgress["state"];
  newFlagged: boolean;
  /**
   * What to record on the open support cycle when this is a reassessment. null = leave it alone:
   * a pending clarification is not a result, and unclear work is not a failure (it goes to the teacher).
   */
  cycleOutcome: Exclude<SupportOutcome, "pending"> | null;
}

export function judgedFrom(diagnosis: Diagnosis, clarified: boolean): JudgedAnswer {
  return {
    questionId: diagnosis.questionId,
    isCorrect: diagnosis.isCorrect,
    reasoningSound: diagnosis.reasoningSound,
    nextAction: diagnosis.nextAction,
    clarified,
  };
}

export function decideSave(
  progress: Pick<ConceptProgress, "state" | "supportCyclesUsed" | "teacherFlagged">,
  kind: SittingKind,
  judged: readonly JudgedAnswer[],
): SaveDecision {
  const outcome = evaluateAttempt(judged);
  const { state, teacherFlagged } = stateAfterAttempt(progress, kind, outcome);
  let cycleOutcome: SaveDecision["cycleOutcome"] = null;
  if (kind === "reassessment") {
    if (outcome === "succeeded") cycleOutcome = "succeeded";
    else if (outcome === "struggled") cycleOutcome = "struggled";
  }
  return { outcome, newState: state, newFlagged: teacherFlagged, cycleOutcome };
}

/**
 * The verdict stored on an answer row. null while a clarification is open: "no verdict yet", never "wrong".
 * Stored so the teacher sees the same thing the student saw.
 */
export function storedVerdict(diagnosis: Diagnosis, clarified: boolean): boolean | null {
  return isUnclearDiagnosis(diagnosis) && !clarified ? null : diagnosis.isCorrect;
}

/** A follow-up diagnosis must carry a question; if the AI forgot, the standard fallback is used. */
export function normaliseDiagnosis(raw: Diagnosis, conceptId: Diagnosis["conceptId"], questionId: string, fallback: string): Diagnosis {
  const asksQuestion = raw.nextAction === "follow_up_question";
  return {
    ...raw,
    conceptId,
    questionId,
    followUpQuestion: asksQuestion ? (raw.followUpQuestion?.trim() ? raw.followUpQuestion : fallback) : null,
  };
}

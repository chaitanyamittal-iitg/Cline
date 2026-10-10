// Pure learning-state rules for one sitting and for support cycles. No database, no network, no "server-only":
// safe to unit-test. Settled by the lead in the fix/learning-contracts milestone. The AI-and-backend owner CALLS
// these from src/lib/learning/** when persisting; do not re-implement the rules elsewhere.
// Teacher-approval rules are in ./teacher-rules.ts.
import {
  MAX_SUPPORT_CYCLES,
  type AttemptOutcome,
  type ConceptProgress,
  type LearningState,
  type NextAction,
} from "@/lib/contracts";

export interface JudgedAnswer {
  questionId: string;
  isCorrect: boolean;
  reasoningSound: boolean;
  nextAction: NextAction;
  /** True once the student has answered the one allowed follow-up for this question. */
  clarified: boolean;
}

/** A correct final answer alone is not enough: the reasoning must be sound too. */
const isSound = (a: JudgedAnswer) => a.isCorrect && a.reasoningSound;
/** The AI could not tell and asked a short question instead of guessing. */
const isUnclear = (a: JudgedAnswer) => !isSound(a) && a.nextAction === "follow_up_question";

/**
 * Judges one sitting (micro-test or reassessment) once every answer is diagnosed. Precedence, on purpose:
 *  1. any unclear answer that has not had its clarification yet -> wait (no verdict, no cycle used);
 *  2. any clear gap (wrong answer, or right answer with faulty reasoning)    -> struggled;
 *  3. any answer still unclear AFTER its clarification                        -> teacher, NOT a failure;
 *  4. everything correct with sound reasoning                                  -> succeeded (awaits the teacher).
 */
export function evaluateAttempt(answers: readonly JudgedAnswer[]): AttemptOutcome {
  if (answers.length === 0) throw new Error("An attempt needs at least one judged answer.");
  if (answers.some((a) => isUnclear(a) && !a.clarified)) return "awaiting_clarification";
  if (answers.some((a) => !isSound(a) && !isUnclear(a))) return "struggled";
  if (answers.some(isUnclear)) return "unclear_needs_teacher";
  return "succeeded";
}

export type SittingKind = "microtest" | "reassessment";
type ProgressFacts = Pick<ConceptProgress, "state" | "supportCyclesUsed" | "teacherFlagged">;

export class IllegalTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalTransitionError";
  }
}

/**
 * New state after a sitting is evaluated. The cycle counter is NOT changed here: a cycle is used up when support
 * STARTS (startSupport), never by a clarification and never by unclear work. Success only reaches 'passed', which
 * never moves a student on; teacherClearedToNext is untouched. After the second unsuccessful cycle the student is
 * flagged for the teacher.
 */
export function stateAfterAttempt(
  progress: ProgressFacts,
  kind: SittingKind,
  outcome: AttemptOutcome,
): { state: LearningState; teacherFlagged: boolean } {
  const allowed: LearningState[] = kind === "microtest" ? ["microtest", "analysis"] : ["reassessment"];
  if (!allowed.includes(progress.state)) {
    throw new IllegalTransitionError(`A ${kind} cannot be evaluated while the state is '${progress.state}'.`);
  }
  switch (outcome) {
    case "awaiting_clarification":
      return { state: kind === "microtest" ? "analysis" : "reassessment", teacherFlagged: progress.teacherFlagged };
    case "succeeded":
      return { state: "passed", teacherFlagged: progress.teacherFlagged };
    case "unclear_needs_teacher":
      return { state: "teacher_flagged", teacherFlagged: true };
    case "struggled":
      return progress.supportCyclesUsed >= MAX_SUPPORT_CYCLES
        ? { state: "teacher_flagged", teacherFlagged: true }
        : { state: "support", teacherFlagged: progress.teacherFlagged };
  }
}

/** At most two automated support/reassessment cycles. A third is refused. */
export function canStartSupport(progress: ProgressFacts): boolean {
  return progress.state === "support" && !progress.teacherFlagged && progress.supportCyclesUsed < MAX_SUPPORT_CYCLES;
}

/** Starting support uses up one cycle and moves to 'reassessment'. */
export function startSupport(progress: ProgressFacts): {
  state: "reassessment";
  supportCyclesUsed: 1 | 2;
  cycleNumber: 1 | 2;
} {
  if (!canStartSupport(progress)) {
    throw new IllegalTransitionError("Support cannot start now (wrong state, flagged, or both cycles already used).");
  }
  const cycleNumber = (progress.supportCyclesUsed + 1) as 1 | 2;
  return { state: "reassessment", supportCyclesUsed: cycleNumber, cycleNumber };
}

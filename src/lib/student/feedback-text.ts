// Plain-language wording for feedback. No numbers, no scores, no ranking. Pure and client-safe.
import type { AttemptOutcome, ConceptProgress, Diagnosis } from "@/lib/contracts";
import { needsTeacher } from "./progress";

export type VerdictKind = "good" | "reasoning" | "notyet" | "clarify" | "teacher";

export interface Verdict {
  kind: VerdictKind;
  label: string;
  /** A symbol so the meaning never depends on colour alone. */
  icon: string;
}

const VERDICTS: Record<VerdictKind, Verdict> = {
  good: { kind: "good", label: "Clear and correct", icon: "\u2713" },
  reasoning: { kind: "reasoning", label: "Right answer, but let\u2019s check the reasoning", icon: "\u2248" },
  notyet: { kind: "notyet", label: "Not quite yet", icon: "\u2192" },
  clarify: { kind: "clarify", label: "A quick question for you", icon: "?" },
  teacher: { kind: "teacher", label: "Your teacher will look at this one", icon: "\u263A" },
};

/** The AI could not tell and asked a short question instead of guessing. */
export function isUnclear(diagnosis: Pick<Diagnosis, "isCorrect" | "reasoningSound" | "nextAction">): boolean {
  return !(diagnosis.isCorrect && diagnosis.reasoningSound) && diagnosis.nextAction === "follow_up_question";
}

/**
 * result === null means "no verdict yet": a clarification is needed. That is never shown as wrong.
 * A question that is still unclear AFTER its clarification (it has a verdict, but is still unclear) goes to the
 * teacher; that is not a failure either.
 */
export function verdictFor(result: boolean | null, diagnosis: Diagnosis | undefined): Verdict {
  if (result === null) return VERDICTS.clarify;
  if (diagnosis && isUnclear(diagnosis)) return VERDICTS.teacher;
  if (result === true && diagnosis?.reasoningSound === false) return VERDICTS.reasoning;
  if (result === true) return VERDICTS.good;
  return VERDICTS.notyet;
}

export interface OutcomeMessage {
  title: string;
  detail: string;
  tone: "normal" | "waiting" | "attention";
}

type ProgressFacts = Pick<ConceptProgress, "state" | "teacherFlagged">;

/** What this sitting amounts to, using BOTH the attempt outcome and the persisted progress. */
export function outcomeMessage(outcome: AttemptOutcome | null, progress: ProgressFacts): OutcomeMessage {
  if (outcome === "unclear_needs_teacher") {
    return {
      title: "Your teacher will take a look",
      detail:
        "We could not tell what you meant from your answers, so your teacher will help. This is not a mistake on your part.",
      tone: "attention",
    };
  }
  if (needsTeacher(progress)) {
    return {
      title: "Your teacher will help you with this concept",
      detail:
        "You have worked hard through the extra help. Your teacher has been told and will help you next. You do not need to do anything right now.",
      tone: "attention",
    };
  }
  switch (outcome) {
    case "awaiting_clarification":
      return {
        title: "A quick question before we finish",
        detail:
          "Some of your answers need a little more from you. This is not a wrong answer. Please answer the short question below.",
        tone: "normal",
      };
    case "succeeded":
      return {
        title: "You showed clear thinking",
        detail:
          "Every answer was correct with sound reasoning. Waiting for your teacher to approve your next concept. You do not move on by yourself.",
        tone: "waiting",
      };
    case "struggled":
      return {
        title: "Some ideas need more work",
        detail: "That is completely fine. The next step is some extra help, and then a few fresh questions.",
        tone: "normal",
      };
    default:
      return {
        title: "Your answers are saved",
        detail: "Some of your answers are still being checked. Please reload this page in a moment.",
        tone: "normal",
      };
  }
}

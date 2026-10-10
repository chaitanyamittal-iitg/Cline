// Plain-language wording and "current concept" selection for the student screens.
// Pure functions over data that was read from the database; nothing here unlocks anything.
// Only the server (via a teacher action) can move a student on, so the UI never infers that from answers.
import { MAX_SUPPORT_CYCLES, type ConceptId, type ConceptProgress, type LearningState } from "@/lib/contracts";

export interface ConceptSummary {
  id: ConceptId;
  position: number;
  title: string;
  objective: string;
}

export type StateTone = "normal" | "waiting" | "attention";

export interface StateMessage {
  /** Short tag, for example "Lesson". */
  label: string;
  headline: string;
  detail: string;
  tone: StateTone;
  /** True when the student has a next step to do inside this concept. */
  canContinue: boolean;
}

export function needsTeacher(progress: Pick<ConceptProgress, "state" | "teacherFlagged">): boolean {
  return progress.state === "teacher_flagged" || progress.teacherFlagged;
}

/**
 * Whether the screen may OFFER the extra-help button. This only decides what to show; the server enforces the real
 * rule (at most two automated support/reassessment cycles) and refuses a third. Mirrors canStartSupport() in
 * src/lib/learning/rules.ts, which client code may not import.
 */
export function canRequestSupport(
  progress: Pick<ConceptProgress, "state" | "teacherFlagged" | "supportCyclesUsed">,
): boolean {
  return progress.state === "support" && !progress.teacherFlagged && progress.supportCyclesUsed < MAX_SUPPORT_CYCLES;
}

export function describeState(progress: ConceptProgress): StateMessage {
  if (needsTeacher(progress)) {
    return {
      label: "Teacher attention needed",
      headline: "Your teacher will help you with this concept",
      detail:
        "Your teacher has been told and will help you with this concept. You do not need to do anything right now. You can read the lesson again while you wait.",
      tone: "attention",
      canContinue: false,
    };
  }

  const byState: Record<Exclude<LearningState, "teacher_flagged">, StateMessage> = {
    lesson: {
      label: "Lesson",
      headline: "Time to learn",
      detail: "Watch the lesson and read the notes. When you have finished, you can ask your doubts.",
      tone: "normal",
      canContinue: true,
    },
    doubts: {
      label: "Doubts",
      headline: "Ask your doubts",
      detail: "Ask about anything you are unsure of. When you have no more doubts, you will start a short written test.",
      tone: "normal",
      canContinue: true,
    },
    microtest: {
      label: "Written test",
      headline: "Your short written test is ready",
      detail: "Answer in your own words. You can type your answer or add a photo of your handwriting.",
      tone: "normal",
      canContinue: true,
    },
    analysis: {
      label: "Checking answers",
      headline: "Your answers are being looked at",
      detail: "Open this concept to see where things stand.",
      tone: "normal",
      canContinue: true,
    },
    support: {
      label: "Extra help",
      headline: "Some extra help is ready for you",
      detail: "Open this concept to read the help and get ready for a few fresh questions.",
      tone: "normal",
      canContinue: true,
    },
    reassessment: {
      label: "Fresh questions",
      headline: "Try a few fresh questions",
      detail: "Show what you have learned from the extra help.",
      tone: "normal",
      canContinue: true,
    },
    passed: progress.teacherClearedToNext
      ? {
          label: "Finished",
          headline: "Your teacher has approved your next concept",
          detail: "It will appear here as soon as it is ready for you. You can read this lesson again meanwhile.",
          tone: "waiting",
          canContinue: false,
        }
      : {
          label: "Finished",
          headline: "Well done, you have finished this concept",
          detail: "Waiting for your teacher to approve your next concept. You can read this lesson again meanwhile.",
          tone: "waiting",
          canContinue: false,
        },
  };

  return byState[progress.state as Exclude<LearningState, "teacher_flagged">];
}

/** Short status text for the concept list. */
export function journeyStatus(progress: ConceptProgress, isCurrent: boolean): string {
  if (needsTeacher(progress)) return "Teacher attention needed";
  if (progress.state === "passed") return "Finished";
  return isCurrent ? "In progress" : "Open";
}

/**
 * The concept to show first: the earliest concept the student has a progress row for that is not yet passed.
 * When every concept they have is passed, the latest one. Rows for unknown concepts are ignored.
 */
export function pickCurrent(
  concepts: ConceptSummary[],
  progress: ConceptProgress[],
): { concept: ConceptSummary; progress: ConceptProgress } | null {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const rows = progress
    .map((p) => ({ progress: p, concept: byId.get(p.conceptId) }))
    .filter((r): r is { progress: ConceptProgress; concept: ConceptSummary } => r.concept !== undefined)
    .sort((a, b) => a.concept.position - b.concept.position);
  if (rows.length === 0) return null;
  return rows.find((r) => r.progress.state !== "passed") ?? rows[rows.length - 1];
}

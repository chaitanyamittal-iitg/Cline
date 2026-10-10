// Pure rules for teacher actions. No database, no network, no "server-only": safe to unit-test.
// Settled by the lead in the fix/learning-contracts milestone; applyTeacherAction (./teacher-actions.ts) uses them.
import type {
  ConceptId,
  ConceptProgress,
  Diagnosis,
  DiagnosisReplacement,
  LearningState,
} from "@/lib/contracts";

export interface ApprovalPlan {
  /** True only when the student had not reached 'passed'. Recorded in the audit row. */
  overrideUnderstanding: boolean;
  stateAtApproval: LearningState;
  /** Next concept in curriculum order, or null on the last concept (completion; nothing is invented). */
  nextConceptId: ConceptId | null;
  /** Set teacher_cleared_to_next on the current concept. */
  setCleared: boolean;
  /** Insert the next concept's progress row in 'lesson' state. Never overwrites an existing row. */
  createNextProgress: boolean;
  /** Nothing needs to change: a repeated approval. Write nothing, reset nothing. */
  alreadyApplied: boolean;
}
export type ApprovalDecision = { ok: true; plan: ApprovalPlan } | { ok: false; reason: string };

/**
 * `curriculum` is the concept ids in teaching order (concepts.position ascending). The next concept is the next
 * entry in that list; ids are never parsed or incremented as numbers. The student's diagnosis is never touched.
 */
export function planApproval(args: {
  progress: ConceptProgress;
  curriculum: readonly ConceptId[];
  nextProgressExists: boolean;
  overrideUnderstanding?: boolean;
  note?: string;
}): ApprovalDecision {
  const { progress, curriculum } = args;
  const index = curriculum.indexOf(progress.conceptId);
  if (index === -1) return { ok: false, reason: `Concept ${progress.conceptId} is not in the curriculum.` };

  const nextConceptId = curriculum[index + 1] ?? null;
  const createNextProgress = nextConceptId !== null && !args.nextProgressExists;

  // A repeated approval never needs the override again and never resets or duplicates anything.
  // If an earlier approval was interrupted before the next row existed, only that missing row is added.
  if (progress.teacherClearedToNext) {
    return {
      ok: true,
      plan: {
        overrideUnderstanding: false,
        stateAtApproval: progress.state,
        nextConceptId,
        setCleared: false,
        createNextProgress,
        alreadyApplied: !createNextProgress,
      },
    };
  }

  const needsOverride = progress.state !== "passed";
  if (needsOverride && (args.overrideUnderstanding !== true || !args.note?.trim())) {
    return {
      ok: false,
      reason:
        "This student has not demonstrated understanding. Approving needs an explicit override and a written " +
        "note. The diagnosis stays as it is.",
    };
  }

  return {
    ok: true,
    plan: {
      overrideUnderstanding: needsOverride,
      stateAtApproval: progress.state,
      nextConceptId,
      setCleared: true,
      createNextProgress,
      alreadyApplied: false,
    },
  };
}

type DiagnosisField = "isCorrect" | "reasoningSound" | "misconception";

/** Which fields the teacher's replacement actually changes. Empty means there is nothing to override. */
export function changedDiagnosisFields(
  original: Pick<Diagnosis, "isCorrect" | "reasoningSound" | "misconception">,
  replacement: DiagnosisReplacement,
): DiagnosisField[] {
  const norm = (s: string | null) => (s === null ? null : s.trim());
  const changed: DiagnosisField[] = [];
  if (original.isCorrect !== replacement.isCorrect) changed.push("isCorrect");
  if (original.reasoningSound !== replacement.reasoningSound) changed.push("reasoningSound");
  if (norm(original.misconception) !== norm(replacement.misconception)) changed.push("misconception");
  return changed;
}

/** Clears the teacher-attention flag and nothing else: state, cycle count and approval are copied unchanged. */
export function clearFlag(progress: ConceptProgress): { progress: ConceptProgress; alreadyApplied: boolean } {
  return { progress: { ...progress, teacherFlagged: false }, alreadyApplied: !progress.teacherFlagged };
}

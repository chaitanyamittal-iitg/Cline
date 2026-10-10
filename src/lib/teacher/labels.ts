// Readable labels for stored values. TEACHER-OWNED. Pure functions (unit-tested in labels.test.ts).
// Labels describe what is STORED. They never add a score, ranking or readiness rule.

/** Learning states from the concept_progress.state check constraint (0002_learning_state.sql). */
export function stateLabel(state: string): string {
  switch (state) {
    case "lesson": return "Lesson";
    case "doubts": return "Doubts";
    case "microtest": return "Micro-test";
    case "analysis": return "Analysis";
    case "support": return "Support";
    case "reassessment": return "Reassessment";
    case "passed": return "Passed";
    case "teacher_flagged": return "Teacher flagged";
    default: return `Unrecognised state (${state})`;
  }
}

/** concept_progress.teacher_flagged. Kept separate from the learning state on purpose. */
export function attentionLabel(flagged: boolean): string {
  return flagged ? "Teacher attention needed" : "No attention flag";
}

/** concept_progress.teacher_cleared_to_next: only records whether a teacher has approved moving on. */
export function approvalLabel(cleared: boolean): string {
  return cleared ? "Teacher has approved moving on" : "No approval recorded";
}

export function attemptKindLabel(kind: string, cycle: number): string {
  switch (kind) {
    case "microtest": return "Initial written micro-test";
    case "reassessment": return `Reassessment (support cycle ${cycle})`;
    default: return `Unrecognised attempt type (${kind})`;
  }
}

export function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "pending": return "Pending";
    case "succeeded": return "Succeeded";
    case "struggled": return "Struggled";
    default: return `Unrecognised outcome (${outcome})`;
  }
}

export function nextActionLabel(action: string): string {
  switch (action) {
    case "follow_up_question": return "Ask a clarifying question";
    case "targeted_support": return "Targeted support";
    case "none": return "No further action";
    default: return `Unrecognised action (${action})`;
  }
}

/** Right/wrong only, never a number. null = the answer has not been assessed. */
export function correctnessLabel(isCorrect: boolean | null): string {
  if (isCorrect === null) return "Not yet assessed";
  return isCorrect ? "Recorded as correct" : "Recorded as incorrect";
}

export function reasoningLabel(sound: boolean): string {
  return sound ? "Reasoning judged sound" : "Reasoning judged not sound";
}

export type SourceTone = "mock" | "live" | "unknown";

/** Label for ai_source / interpreted_by. Anything that is not exactly "live" is never called live. */
export function aiSourceInfo(source: string | null | undefined): { label: string; tone: SourceTone } {
  if (source === "mock") return { label: "MOCK AI", tone: "mock" };
  if (source === "live") return { label: "Live AI", tone: "live" };
  if (source === null || source === undefined) return { label: "AI source not recorded", tone: "unknown" };
  return { label: "Unrecognised AI source", tone: "unknown" };
}

/** Deterministic UTC timestamp, e.g. "2026-10-10 08:30 UTC". Returns the input when it is not a date. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

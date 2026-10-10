import { describe, expect, it } from "vitest";
import type { Diagnosis } from "@/lib/contracts";
import { isUnclear, outcomeMessage, verdictFor } from "./feedback-text";
import { canRequestSupport } from "./progress";

function diagnosis(over: Partial<Diagnosis> = {}): Diagnosis {
  return {
    conceptId: "C3",
    questionId: "C3-Q1",
    isCorrect: true,
    reasoningSound: true,
    misconception: null,
    evidence: "Mentions a complete path.",
    nextAction: "none",
    followUpQuestion: null,
    source: "mock",
    ...over,
  };
}

describe("verdictFor", () => {
  it("shows isCorrect:null as a clarification, never as wrong", () => {
    const v = verdictFor(null, undefined);
    expect(v.kind).toBe("clarify");
    expect(v.label).not.toMatch(/wrong|incorrect/i);
  });

  it("distinguishes right-with-sound-reasoning, right-with-faulty-reasoning and not-yet", () => {
    expect(verdictFor(true, diagnosis()).kind).toBe("good");
    expect(verdictFor(true, diagnosis({ reasoningSound: false, nextAction: "targeted_support" })).kind).toBe("reasoning");
    expect(
      verdictFor(false, diagnosis({ isCorrect: false, reasoningSound: false, nextAction: "targeted_support" })).kind,
    ).toBe("notyet");
  });

  it("sends a question that is still unclear after its clarification to the teacher, not to failure", () => {
    const stillUnclear = diagnosis({
      isCorrect: false,
      reasoningSound: false,
      nextAction: "follow_up_question",
      followUpQuestion: "Say more?",
    });
    expect(isUnclear(stillUnclear)).toBe(true);
    expect(verdictFor(false, stillUnclear).kind).toBe("teacher");
  });

  it("never uses the words wrong, incorrect, fail, score, mark or a digit in any label", () => {
    const labels = [
      verdictFor(null, undefined),
      verdictFor(true, diagnosis()),
      verdictFor(true, diagnosis({ reasoningSound: false })),
      verdictFor(false, diagnosis({ isCorrect: false, reasoningSound: false })),
    ].map((v) => v.label);
    for (const label of labels) expect(label).not.toMatch(/wrong|incorrect|fail|score|mark|\d/i);
  });
});

describe("outcomeMessage", () => {
  const calm = { state: "analysis", teacherFlagged: false } as const;

  it("treats awaiting_clarification as a question, not a failure", () => {
    const m = outcomeMessage("awaiting_clarification", calm);
    expect(m.detail).toMatch(/not a wrong answer/i);
    expect(m.tone).toBe("normal");
  });

  it("says success waits for the teacher and never unlocks anything", () => {
    const m = outcomeMessage("succeeded", { state: "passed", teacherFlagged: false });
    expect(m.tone).toBe("waiting");
    expect(m.detail).toMatch(/waiting for your teacher to approve/i);
    expect(m.detail).toMatch(/do not move on by yourself/i);
  });

  it("asks for teacher attention for unclear_needs_teacher without blaming the student", () => {
    const m = outcomeMessage("unclear_needs_teacher", { state: "teacher_flagged", teacherFlagged: true });
    expect(m.tone).toBe("attention");
    expect(m.detail).toMatch(/not a mistake on your part/i);
  });

  it("shows teacher attention when the persisted progress is flagged, whatever the outcome says", () => {
    const m = outcomeMessage("struggled", { state: "teacher_flagged", teacherFlagged: true });
    expect(m.tone).toBe("attention");
    expect(m.detail).not.toMatch(/extra help, and then/i);
  });

  it("contains no digits in any message", () => {
    for (const o of ["awaiting_clarification", "succeeded", "struggled", "unclear_needs_teacher", null] as const) {
      const m = outcomeMessage(o, calm);
      expect(`${m.title} ${m.detail}`).not.toMatch(/\d/);
    }
  });
});

describe("canRequestSupport", () => {
  const base = { state: "support", teacherFlagged: false, supportCyclesUsed: 0 } as const;

  it("is offered in the support state with cycles left", () => {
    expect(canRequestSupport(base)).toBe(true);
    expect(canRequestSupport({ ...base, supportCyclesUsed: 1 })).toBe(true);
  });

  it("never offers a third automated cycle", () => {
    expect(canRequestSupport({ ...base, supportCyclesUsed: 2 })).toBe(false);
  });

  it("is not offered when flagged or in any other state", () => {
    expect(canRequestSupport({ ...base, teacherFlagged: true })).toBe(false);
    for (const state of ["lesson", "doubts", "microtest", "analysis", "reassessment", "passed", "teacher_flagged"] as const) {
      expect(canRequestSupport({ ...base, state }), state).toBe(false);
    }
  });
});

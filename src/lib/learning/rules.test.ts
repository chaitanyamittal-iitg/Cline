import { describe, expect, it } from "vitest";
import {
  IllegalTransitionError,
  canStartSupport,
  evaluateAttempt,
  startSupport,
  stateAfterAttempt,
  type JudgedAnswer,
} from "./rules";

const ok: JudgedAnswer = { questionId: "q1", isCorrect: true, reasoningSound: true, nextAction: "none", clarified: false };
const wrong: JudgedAnswer = { ...ok, isCorrect: false, reasoningSound: false, nextAction: "targeted_support" };
const luckyRight: JudgedAnswer = { ...ok, reasoningSound: false, nextAction: "targeted_support" };
const unclear: JudgedAnswer = { ...ok, isCorrect: false, reasoningSound: false, nextAction: "follow_up_question" };

describe("evaluateAttempt", () => {
  it("succeeds only when every answer is correct with sound reasoning", () => {
    expect(evaluateAttempt([ok, ok])).toBe("succeeded");
  });

  it("does not treat a correct answer with faulty reasoning as success", () => {
    expect(evaluateAttempt([luckyRight])).toBe("struggled");
    expect(evaluateAttempt([ok, luckyRight])).toBe("struggled");
  });

  it("treats a wrong answer as struggling", () => {
    expect(evaluateAttempt([ok, wrong])).toBe("struggled");
  });

  it("waits for a clarification instead of judging unclear work", () => {
    expect(evaluateAttempt([unclear])).toBe("awaiting_clarification");
    expect(evaluateAttempt([wrong, unclear])).toBe("awaiting_clarification");
  });

  it("sends work that is still unclear after its clarification to the teacher, not to failure", () => {
    expect(evaluateAttempt([{ ...unclear, clarified: true }])).toBe("unclear_needs_teacher");
    expect(evaluateAttempt([ok, { ...unclear, clarified: true }])).toBe("unclear_needs_teacher");
  });

  it("lets a clear gap outrank unclear work", () => {
    expect(evaluateAttempt([wrong, { ...unclear, clarified: true }])).toBe("struggled");
  });

  it("succeeds when a clarification resolved the doubt", () => {
    expect(evaluateAttempt([{ ...ok, clarified: true }])).toBe("succeeded");
  });

  it("refuses an empty attempt", () => {
    expect(() => evaluateAttempt([])).toThrow();
  });
});

describe("stateAfterAttempt", () => {
  const base = { state: "microtest" as const, supportCyclesUsed: 0, teacherFlagged: false };

  it("moves success to passed, never past it", () => {
    expect(stateAfterAttempt(base, "microtest", "succeeded")).toEqual({ state: "passed", teacherFlagged: false });
    expect(stateAfterAttempt({ ...base, state: "reassessment", supportCyclesUsed: 2 }, "reassessment", "succeeded").state).toBe("passed");
  });

  it("keeps a clarification pending without using a cycle or flagging", () => {
    const after = stateAfterAttempt({ ...base, supportCyclesUsed: 1, state: "reassessment" }, "reassessment", "awaiting_clarification");
    expect(after).toEqual({ state: "reassessment", teacherFlagged: false });
  });

  it("moves the first failure to support and the second to support again", () => {
    expect(stateAfterAttempt(base, "microtest", "struggled").state).toBe("support");
    expect(stateAfterAttempt({ ...base, state: "reassessment", supportCyclesUsed: 1 }, "reassessment", "struggled").state).toBe("support");
  });

  it("flags the teacher after the second unsuccessful cycle", () => {
    const after = stateAfterAttempt({ ...base, state: "reassessment", supportCyclesUsed: 2 }, "reassessment", "struggled");
    expect(after).toEqual({ state: "teacher_flagged", teacherFlagged: true });
  });

  it("flags unclear work for the teacher without a cycle", () => {
    expect(stateAfterAttempt(base, "microtest", "unclear_needs_teacher")).toEqual({ state: "teacher_flagged", teacherFlagged: true });
  });

  it("rejects an illegal transition", () => {
    expect(() => stateAfterAttempt({ ...base, state: "lesson" }, "microtest", "succeeded")).toThrow(IllegalTransitionError);
    expect(() => stateAfterAttempt({ ...base, state: "passed" }, "microtest", "struggled")).toThrow(IllegalTransitionError);
    expect(() => stateAfterAttempt({ ...base, state: "microtest" }, "reassessment", "succeeded")).toThrow(IllegalTransitionError);
  });
});

describe("support cycles", () => {
  const support = (used: number, flagged = false) => ({ state: "support" as const, supportCyclesUsed: used, teacherFlagged: flagged });

  it("uses cycle 1 then cycle 2", () => {
    expect(startSupport(support(0))).toEqual({ state: "reassessment", supportCyclesUsed: 1, cycleNumber: 1 });
    expect(startSupport(support(1))).toEqual({ state: "reassessment", supportCyclesUsed: 2, cycleNumber: 2 });
  });

  it("refuses a third automated cycle", () => {
    expect(canStartSupport(support(2))).toBe(false);
    expect(() => startSupport(support(2))).toThrow(IllegalTransitionError);
  });

  it("refuses support outside the support state or while flagged", () => {
    expect(canStartSupport({ state: "microtest", supportCyclesUsed: 0, teacherFlagged: false })).toBe(false);
    expect(canStartSupport(support(0, true))).toBe(false);
  });
});

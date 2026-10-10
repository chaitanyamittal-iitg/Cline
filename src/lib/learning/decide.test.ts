import { describe, expect, it } from "vitest";
import type { Diagnosis } from "@/lib/contracts";
import { decideSave, judgedFrom, normaliseDiagnosis, storedVerdict } from "./decide";
import { IllegalTransitionError, type JudgedAnswer } from "./rules";

const sound: JudgedAnswer = { questionId: "q", isCorrect: true, reasoningSound: true, nextAction: "none", clarified: false };
const wrong: JudgedAnswer = { questionId: "q", isCorrect: false, reasoningSound: false, nextAction: "targeted_support", clarified: false };
const unclear: JudgedAnswer = { questionId: "q", isCorrect: true, reasoningSound: false, nextAction: "follow_up_question", clarified: false };
const stillUnclear: JudgedAnswer = { ...unclear, clarified: true };

const at = (state: "microtest" | "analysis" | "reassessment", used = 0) => ({ state, supportCyclesUsed: used, teacherFlagged: false });

describe("decideSave: cycles, clarification and the teacher", () => {
  it("a struggling first test opens support without using a cycle yet", () => {
    expect(decideSave(at("microtest"), "microtest", [wrong])).toEqual({ outcome: "struggled", newState: "support", newFlagged: false, cycleOutcome: null });
  });

  it("success on the first test only reaches 'passed': it never approves moving on", () => {
    const d = decideSave(at("microtest"), "microtest", [sound]);
    expect(d).toMatchObject({ outcome: "succeeded", newState: "passed", newFlagged: false });
    expect(Object.keys(d)).not.toContain("teacherClearedToNext");
  });

  it("success on a reassessment records the cycle as succeeded and awaits the teacher", () => {
    expect(decideSave(at("reassessment", 1), "reassessment", [sound])).toEqual({ outcome: "succeeded", newState: "passed", newFlagged: false, cycleOutcome: "succeeded" });
  });

  it("struggling after the FIRST cycle leads to a second one", () => {
    expect(decideSave(at("reassessment", 1), "reassessment", [wrong])).toMatchObject({ newState: "support", newFlagged: false, cycleOutcome: "struggled" });
  });

  it("struggling after the SECOND cycle flags the teacher and offers no third cycle", () => {
    expect(decideSave(at("reassessment", 2), "reassessment", [wrong])).toEqual({ outcome: "struggled", newState: "teacher_flagged", newFlagged: true, cycleOutcome: "struggled" });
  });

  it("an open clarification keeps the sitting open and uses no cycle", () => {
    expect(decideSave(at("microtest"), "microtest", [unclear, sound])).toEqual({ outcome: "awaiting_clarification", newState: "analysis", newFlagged: false, cycleOutcome: null });
    expect(decideSave(at("reassessment", 1), "reassessment", [unclear])).toEqual({ outcome: "awaiting_clarification", newState: "reassessment", newFlagged: false, cycleOutcome: null });
  });

  it("work that stays unclear goes to the teacher and is NOT recorded as a failed cycle", () => {
    expect(decideSave(at("analysis"), "microtest", [stillUnclear])).toEqual({ outcome: "unclear_needs_teacher", newState: "teacher_flagged", newFlagged: true, cycleOutcome: null });
    expect(decideSave(at("reassessment", 1), "reassessment", [stillUnclear]).cycleOutcome).toBeNull();
  });

  it("a clarified question that turns out sound can still lead to success", () => {
    expect(decideSave(at("analysis"), "microtest", [{ ...sound, clarified: true }, sound]).outcome).toBe("succeeded");
  });

  it("refuses to judge a sitting in the wrong state", () => {
    expect(() => decideSave({ state: "passed", supportCyclesUsed: 0, teacherFlagged: false }, "microtest", [sound])).toThrow(IllegalTransitionError);
    expect(() => decideSave(at("microtest"), "reassessment", [sound])).toThrow(IllegalTransitionError);
  });
});

const diagnosis = (over: Partial<Diagnosis>): Diagnosis => ({
  conceptId: "C3", questionId: "C3-Q1", isCorrect: true, reasoningSound: false, misconception: "m", evidence: "e",
  nextAction: "follow_up_question", followUpQuestion: "Why?", source: "mock", ...over,
});

describe("storedVerdict and normaliseDiagnosis", () => {
  it("stores no verdict while a clarification is open, and the real verdict afterwards", () => {
    expect(storedVerdict(diagnosis({}), false)).toBeNull();
    expect(storedVerdict(diagnosis({}), true)).toBe(true);
    expect(storedVerdict(diagnosis({ isCorrect: false, nextAction: "targeted_support", followUpQuestion: null }), false)).toBe(false);
  });

  it("copies the facts the rules judge from", () => {
    expect(judgedFrom(diagnosis({}), true)).toEqual({ questionId: "C3-Q1", isCorrect: true, reasoningSound: false, nextAction: "follow_up_question", clarified: true });
  });

  it("forces the concept and question to the saved ones, and never trusts a stray follow-up question", () => {
    const n = normaliseDiagnosis(diagnosis({ conceptId: "C1", questionId: "other", nextAction: "none", followUpQuestion: "stray" }), "C3", "C3-Q1", "fallback");
    expect(n).toMatchObject({ conceptId: "C3", questionId: "C3-Q1", followUpQuestion: null });
    expect(normaliseDiagnosis(diagnosis({ followUpQuestion: "  " }), "C3", "C3-Q1", "fallback").followUpQuestion).toBe("fallback");
  });

  it("keeps the source label of the AI that produced it", () => {
    expect(normaliseDiagnosis(diagnosis({ source: "mock" }), "C3", "C3-Q1", "f").source).toBe("mock");
  });
});

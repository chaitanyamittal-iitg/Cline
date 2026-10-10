import { describe, expect, it } from "vitest";
import type { ConceptProgress } from "@/lib/contracts";
import { changedDiagnosisFields, clearFlag, planApproval } from "./teacher-rules";

const studentId = "123e4567-e89b-42d3-a456-426614174000";
const progress = (over: Partial<ConceptProgress> = {}): ConceptProgress => ({
  studentId, conceptId: "C3", state: "passed", supportCyclesUsed: 0, teacherFlagged: false, teacherClearedToNext: false, ...over,
});
// Curriculum order comes from concepts.position, NOT from the numbers in the ids.
const curriculum = ["C1", "C2", "C3", "C4"] as const;
const shuffled = ["C3", "C1", "C4", "C2"] as const;

describe("planApproval", () => {
  it("approves a passed student and creates the next concept in lesson state", () => {
    const d = planApproval({ progress: progress(), curriculum, nextProgressExists: false });
    expect(d).toEqual({ ok: true, plan: {
      overrideUnderstanding: false, stateAtApproval: "passed", nextConceptId: "C4",
      setCleared: true, createNextProgress: true, alreadyApplied: false,
    } });
  });

  it("uses curriculum order, not arithmetic on ids", () => {
    // Teaching order is C3, C1, C4, C2: the concept after C3 is C1 (not C4), and after C1 it is C4 (not C2).
    const d = planApproval({ progress: progress({ conceptId: "C3" }), curriculum: shuffled, nextProgressExists: false });
    expect(d.ok && d.plan.nextConceptId).toBe("C1");
    const e = planApproval({ progress: progress({ conceptId: "C1" }), curriculum: shuffled, nextProgressExists: false });
    expect(e.ok && e.plan.nextConceptId).toBe("C4");
    const last = planApproval({ progress: progress({ conceptId: "C2" }), curriculum: shuffled, nextProgressExists: false });
    expect(last.ok && last.plan.nextConceptId).toBeNull();
  });

  it("preserves an existing next-concept row", () => {
    const d = planApproval({ progress: progress(), curriculum, nextProgressExists: true });
    expect(d.ok && d.plan.createNextProgress).toBe(false);
    expect(d.ok && d.plan.setCleared).toBe(true);
  });

  it("records completion on the last concept without inventing another", () => {
    const d = planApproval({ progress: progress({ conceptId: "C4" }), curriculum, nextProgressExists: false });
    expect(d.ok && d.plan.nextConceptId).toBeNull();
    expect(d.ok && d.plan.createNextProgress).toBe(false);
    expect(d.ok && d.plan.setCleared).toBe(true);
  });

  it("refuses to approve a student who has not passed without an override and a note", () => {
    const p = progress({ state: "support" });
    expect(planApproval({ progress: p, curriculum, nextProgressExists: false }).ok).toBe(false);
    expect(planApproval({ progress: p, curriculum, nextProgressExists: false, overrideUnderstanding: true }).ok).toBe(false);
    expect(planApproval({ progress: p, curriculum, nextProgressExists: false, overrideUnderstanding: true, note: "   " }).ok).toBe(false);
    expect(planApproval({ progress: p, curriculum, nextProgressExists: false, note: "I judge she is ready" }).ok).toBe(false);
  });

  it("allows an explicit override with a note, and records that it was an override", () => {
    const d = planApproval({
      progress: progress({ state: "teacher_flagged", teacherFlagged: true }),
      curriculum, nextProgressExists: false, overrideUnderstanding: true, note: "Showed it orally in class.",
    });
    expect(d.ok && d.plan.overrideUnderstanding).toBe(true);
    expect(d.ok && d.plan.stateAtApproval).toBe("teacher_flagged");
  });

  it("does not duplicate or reset anything on a repeated approval", () => {
    const d = planApproval({ progress: progress({ teacherClearedToNext: true }), curriculum, nextProgressExists: true });
    expect(d).toEqual({ ok: true, plan: {
      overrideUnderstanding: false, stateAtApproval: "passed", nextConceptId: "C4",
      setCleared: false, createNextProgress: false, alreadyApplied: true,
    } });
  });

  it("does not demand the override again on a repeat, and only repairs a missing next row", () => {
    const d = planApproval({
      progress: progress({ state: "support", teacherClearedToNext: true }), curriculum, nextProgressExists: false,
    });
    expect(d.ok && d.plan.setCleared).toBe(false);
    expect(d.ok && d.plan.createNextProgress).toBe(true);
    expect(d.ok && d.plan.alreadyApplied).toBe(false);
  });

  it("rejects a concept that is not in the curriculum", () => {
    expect(planApproval({ progress: progress({ conceptId: "C2" }), curriculum: ["C3", "C4"], nextProgressExists: false }).ok).toBe(false);
  });
});

describe("changedDiagnosisFields", () => {
  const original = { isCorrect: true, reasoningSound: false, misconception: "No reason given" };

  it("lists only what the teacher changed", () => {
    expect(changedDiagnosisFields(original, { isCorrect: true, reasoningSound: true, misconception: null }))
      .toEqual(["reasoningSound", "misconception"]);
  });

  it("returns nothing when the replacement matches", () => {
    expect(changedDiagnosisFields(original, { ...original })).toEqual([]);
  });
});

describe("clearFlag", () => {
  it("clears only the flag", () => {
    const before = progress({ state: "teacher_flagged", supportCyclesUsed: 2, teacherFlagged: true, teacherClearedToNext: false });
    const { progress: after, alreadyApplied } = clearFlag(before);
    expect(after).toEqual({ ...before, teacherFlagged: false });
    expect(after.state).toBe("teacher_flagged");
    expect(after.supportCyclesUsed).toBe(2);
    expect(after.teacherClearedToNext).toBe(false);
    expect(alreadyApplied).toBe(false);
  });

  it("is a no-op when nothing is flagged", () => {
    expect(clearFlag(progress()).alreadyApplied).toBe(true);
  });
});

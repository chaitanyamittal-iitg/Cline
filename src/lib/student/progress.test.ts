import { describe, expect, it } from "vitest";
import type { ConceptId, ConceptProgress, LearningState } from "@/lib/contracts";
import { describeState, journeyStatus, needsTeacher, pickCurrent, type ConceptSummary } from "./progress";

const STUDENT = "11111111-1111-4111-8111-111111111111";

const concepts: ConceptSummary[] = (["C1", "C2", "C3", "C4"] as ConceptId[]).map((id, i) => ({
  id,
  position: i + 1,
  title: `Concept ${id}`,
  objective: "Objective",
}));

function row(conceptId: ConceptId, state: LearningState, extra: Partial<ConceptProgress> = {}): ConceptProgress {
  return {
    studentId: STUDENT,
    conceptId,
    state,
    supportCyclesUsed: 0,
    teacherFlagged: false,
    teacherClearedToNext: false,
    ...extra,
  };
}

describe("pickCurrent", () => {
  it("returns null when the student has no progress rows", () => {
    expect(pickCurrent(concepts, [])).toBeNull();
  });

  it("returns the concept the student actually has a row for", () => {
    expect(pickCurrent(concepts, [row("C3", "lesson")])?.concept.id).toBe("C3");
  });

  it("prefers the earliest concept that is not yet passed", () => {
    const current = pickCurrent(concepts, [row("C2", "passed"), row("C3", "doubts"), row("C1", "passed")]);
    expect(current?.concept.id).toBe("C3");
  });

  it("falls back to the latest passed concept when everything is passed", () => {
    expect(pickCurrent(concepts, [row("C1", "passed"), row("C2", "passed")])?.concept.id).toBe("C2");
  });

  it("ignores rows for concepts that are not in the concepts list", () => {
    expect(pickCurrent([], [row("C3", "lesson")])).toBeNull();
  });
});

describe("describeState", () => {
  it("lets the student continue in every working state", () => {
    for (const state of ["lesson", "doubts", "microtest", "analysis", "support", "reassessment"] as LearningState[]) {
      const message = describeState(row("C3", state));
      expect(message.canContinue, state).toBe(true);
      expect(message.tone, state).toBe("normal");
    }
  });

  it("says a passed concept is waiting for the teacher, and offers no next step", () => {
    const message = describeState(row("C3", "passed"));
    expect(message.canContinue).toBe(false);
    expect(message.tone).toBe("waiting");
    expect(message.detail).toMatch(/waiting for your teacher/i);
  });

  it("only mentions teacher approval as granted when the teacher actually cleared it", () => {
    const message = describeState(row("C3", "passed", { teacherClearedToNext: true }));
    expect(message.headline).toMatch(/approved your next concept/i);
    expect(message.canContinue).toBe(false);
  });

  it("asks for teacher attention for a flagged concept", () => {
    const message = describeState(row("C3", "teacher_flagged", { teacherFlagged: true }));
    expect(message.tone).toBe("attention");
    expect(message.canContinue).toBe(false);
  });

  it("treats the flag as teacher attention even if the state text lags behind", () => {
    expect(needsTeacher(row("C3", "reassessment", { teacherFlagged: true }))).toBe(true);
    expect(describeState(row("C3", "reassessment", { teacherFlagged: true })).tone).toBe("attention");
  });

  it("never puts a number or score in the wording", () => {
    for (const state of ["lesson", "doubts", "microtest", "analysis", "support", "reassessment", "passed", "teacher_flagged"] as LearningState[]) {
      const m = describeState(row("C3", state, { supportCyclesUsed: 2 }));
      expect(`${m.label} ${m.headline} ${m.detail}`, state).not.toMatch(/\d/);
    }
  });
});

describe("journeyStatus", () => {
  it("describes open, finished and flagged concepts", () => {
    expect(journeyStatus(row("C3", "lesson"), true)).toBe("In progress");
    expect(journeyStatus(row("C3", "lesson"), false)).toBe("Open");
    expect(journeyStatus(row("C2", "passed"), false)).toBe("Finished");
    expect(journeyStatus(row("C3", "teacher_flagged", { teacherFlagged: true }), true)).toBe("Teacher attention needed");
  });
});

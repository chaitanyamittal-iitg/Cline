import { describe, expect, it } from "vitest";
import { buildSupportCycleViews, describeSupport } from "./support";
import type { AttemptRow, DiagnosisRow, SupportCycleRow } from "./types";

const cycle = (over: Partial<SupportCycleRow>): SupportCycleRow => ({
  id: "cy1",
  concept_id: "C3",
  cycle_number: 1,
  diagnosis_id: null,
  support: {},
  reassessment_attempt_id: null,
  outcome: "pending",
  ai_source: "mock",
  created_at: "2026-10-10T08:00:00Z",
  ...over,
});
const diagnosis = (id: string): DiagnosisRow => ({
  id,
  answer_id: null,
  concept_id: "C3",
  is_correct: false,
  reasoning_sound: false,
  misconception: "needs a closed loop",
  evidence: "e",
  next_action: "targeted_support",
  follow_up_question: null,
  ai_source: "mock",
  created_at: "2026-10-10T07:00:00Z",
});
const attempt = (id: string): AttemptRow => ({
  id,
  concept_id: "C3",
  kind: "reassessment",
  cycle: 1,
  questions: [],
  ai_source: "mock",
  created_at: "2026-10-10T09:00:00Z",
});

describe("describeSupport", () => {
  it("reads the SupportPlan keys in a fixed order and keeps wording untouched", () => {
    const out = describeSupport({
      practiceTask: "Draw it.\nThen label it.",
      explanation: "A circuit must be closed.",
      guidingQuestion: "Where is the gap?",
      targetMisconception: "one wire is enough",
      resourceIds: ["C3-diagram-open"],
      source: "mock",
    });
    expect(out.fields.map((f) => f.label)).toEqual([
      "Misconception targeted",
      "Explanation",
      "Guiding question",
      "Practice task",
    ]);
    expect(out.fields[3].value).toBe("Draw it.\nThen label it.");
    expect(out.resourceIds).toEqual(["C3-diagram-open"]);
    expect(out.other).toBeNull();
  });

  it("keeps unrecognised content visible instead of dropping or interpreting it", () => {
    const out = describeSupport({ explanation: "x", mystery: { a: 1 }, resourceIds: "not-a-list" });
    expect(out.other).toContain("mystery");
    expect(out.other).toContain("resourceIds");
    expect(out.resourceIds).toEqual([]);
  });

  it("handles strings, nulls and non-objects without throwing", () => {
    expect(describeSupport("plain text").fields[0].value).toBe("plain text");
    expect(describeSupport(null)).toEqual({ fields: [], resourceIds: [], other: null });
    expect(describeSupport([1, 2]).other).toContain("1");
  });
});

describe("buildSupportCycleViews", () => {
  it("orders by cycle number and resolves only real links", () => {
    const views = buildSupportCycleViews(
      [
        cycle({ id: "b", cycle_number: 2, diagnosis_id: "d2", reassessment_attempt_id: "a2" }),
        cycle({ id: "a", cycle_number: 1, diagnosis_id: "d1", reassessment_attempt_id: null }),
      ],
      [diagnosis("d1"), diagnosis("d2")],
      [attempt("a2")],
    );
    expect(views.map((v) => v.cycle.id)).toEqual(["a", "b"]);
    expect(views[0].triggerDiagnosis.state).toBe("found");
    expect(views[0].reassessmentAttempt.state).toBe("none");
    expect(views[1].reassessmentAttempt.state).toBe("found");
  });

  it("reports a stored link whose record is missing or not loaded as unavailable, never as 'none'", () => {
    const missing = buildSupportCycleViews([cycle({ diagnosis_id: "gone", reassessment_attempt_id: "gone2" })], [], []);
    expect(missing[0].triggerDiagnosis.state).toBe("unavailable");
    expect(missing[0].reassessmentAttempt.state).toBe("unavailable");
    const notLoaded = buildSupportCycleViews([cycle({ diagnosis_id: "d1" })], null, null);
    expect(notLoaded[0].triggerDiagnosis.state).toBe("unavailable");
  });
});

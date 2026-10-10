import { describe, expect, it } from "vitest";
import { LIMITS, buildAssignSupport, buildOverride } from "./action-inputs";
import { toDiagnosisOptions, toResourceOptions } from "./options";
import type { DiagnosisRow } from "./types";

const target = { studentId: "123e4567-e89b-42d3-a456-426614174000", conceptId: "C3" as const };
const diagnosisId = "323e4567-e89b-42d3-a456-426614174002";
const errorsOf = (r: { ok: boolean; errors?: Record<string, string> }) => (r.ok ? {} : (r.errors ?? {}));

describe("assign support", () => {
  const ok = { explanation: "Trace the loop.", guidingQuestion: "", practiceTask: "", resourceIds: [] as string[], note: "" };

  it("requires an explanation and turns blank optional fields into null", () => {
    expect(errorsOf(buildAssignSupport(target, { ...ok, explanation: " " }))).toHaveProperty("explanation");
    const r = buildAssignSupport(target, ok);
    expect(r.ok && r.input).toMatchObject({
      action: "assign_support",
      support: { explanation: "Trace the loop.", guidingQuestion: null, practiceTask: null, resourceIds: [] },
    });
  });

  it("enforces the contract's lengths and the five-resource cap", () => {
    expect(errorsOf(buildAssignSupport(target, { ...ok, guidingQuestion: "x".repeat(LIMITS.guidingQuestion + 1) }))).toHaveProperty("guidingQuestion");
    expect(errorsOf(buildAssignSupport(target, { ...ok, practiceTask: "x".repeat(LIMITS.practiceTask + 1) }))).toHaveProperty("practiceTask");
    expect(errorsOf(buildAssignSupport(target, { ...ok, explanation: "x".repeat(LIMITS.explanation + 1) }))).toHaveProperty("explanation");
    expect(errorsOf(buildAssignSupport(target, { ...ok, resourceIds: ["a", "b", "c", "d", "e", "f"] }))).toHaveProperty("resourceIds");
  });

  it("sends the chosen resource ids unchanged", () => {
    const r = buildAssignSupport(target, { ...ok, resourceIds: ["C3-diagram-open"] });
    expect(r.ok && r.input).toMatchObject({ support: { resourceIds: ["C3-diagram-open"] } });
  });
});

describe("override diagnosis", () => {
  const ok = { diagnosisId, isCorrect: false, reasoningSound: false, misconception: "thinks one wire is enough", reason: "The answer shows it." };

  it("requires a real diagnosis id and a reason", () => {
    expect(errorsOf(buildOverride(target, { ...ok, diagnosisId: "" }))).toHaveProperty("diagnosisId");
    expect(errorsOf(buildOverride(target, { ...ok, reason: "  " }))).toHaveProperty("reason");
  });

  it("sends exactly the contract's replacement fields", () => {
    const r = buildOverride(target, ok);
    expect(r.ok && r.input).toMatchObject({
      action: "override_diagnosis",
      diagnosisId,
      replacement: { isCorrect: false, reasoningSound: false, misconception: "thinks one wire is enough" },
      note: "The answer shows it.",
    });
  });

  it("refuses a misconception on a correct answer with sound reasoning, and allows none", () => {
    expect(errorsOf(buildOverride(target, { ...ok, isCorrect: true, reasoningSound: true }))).toHaveProperty("misconception");
    const none = buildOverride(target, { ...ok, isCorrect: true, reasoningSound: true, misconception: "" });
    expect(none.ok && none.input).toMatchObject({ replacement: { misconception: null } });
  });

  it("enforces the 500-character misconception limit", () => {
    expect(errorsOf(buildOverride(target, { ...ok, misconception: "x".repeat(LIMITS.misconception + 1) }))).toHaveProperty("misconception");
  });
});

describe("selectable records come only from real rows", () => {
  const row = (id: string, created: string): DiagnosisRow => ({
    id, answer_id: null, concept_id: "C3", is_correct: false, reasoning_sound: false, misconception: null,
    evidence: "e", next_action: "none", follow_up_question: null, ai_source: "mock", created_at: created,
  });

  it("maps real diagnosis rows to options with their real ids, oldest first, and invents none", () => {
    const out = toDiagnosisOptions([row("b", "2026-10-10T09:00:00Z"), row("a", "2026-10-10T08:00:00Z")]);
    expect(out.map((o) => o.id)).toEqual(["a", "b"]);
    expect(toDiagnosisOptions([])).toEqual([]);
    expect(toResourceOptions([])).toEqual([]);
  });
});

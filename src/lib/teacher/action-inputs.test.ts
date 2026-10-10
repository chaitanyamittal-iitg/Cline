import { describe, expect, it } from "vitest";
import { LIMITS, buildApproval, buildClearFlag, buildNote } from "./action-inputs";

const target = { studentId: "123e4567-e89b-42d3-a456-426614174000", conceptId: "C3" as const };
const errorsOf = (r: { ok: boolean; errors?: Record<string, string> }) => (r.ok ? {} : (r.errors ?? {}));

describe("approval", () => {
  it("needs the override box AND a non-blank note when the state is not passed", () => {
    expect(errorsOf(buildApproval(target, { state: "lesson", override: false, note: "" }))).toMatchObject({
      override: expect.any(String),
      note: expect.any(String),
    });
    expect(errorsOf(buildApproval(target, { state: "lesson", override: true, note: "   " }))).toHaveProperty("note");
    expect(errorsOf(buildApproval(target, { state: "lesson", override: false, note: "Because." }))).toHaveProperty("override");
  });

  it("sends overrideUnderstanding and the note when both are given", () => {
    const r = buildApproval(target, { state: "analysis", override: true, note: "Ready in my judgement." });
    expect(r.ok && r.input).toMatchObject({ action: "approve_next_concept", overrideUnderstanding: true, note: "Ready in my judgement." });
  });

  it("needs nothing extra for a passed student, and never sends an override for one", () => {
    const r = buildApproval(target, { state: "passed", override: true, note: "" });
    expect(r.ok).toBe(true);
    expect(r.ok && r.input).not.toHaveProperty("overrideUnderstanding");
    expect(r.ok && r.input).not.toHaveProperty("note");
  });

  it("sends only the real target and action: no actor, no teacher id", () => {
    const r = buildApproval(target, { state: "passed", override: false, note: "" });
    expect(r.ok && Object.keys(r.input).sort()).toEqual(["action", "conceptId", "studentId"]);
  });

  it("refuses a note over 2000 characters", () => {
    expect(errorsOf(buildApproval(target, { state: "passed", override: false, note: "x".repeat(LIMITS.note + 1) }))).toHaveProperty("note");
  });
});

describe("clear flag and note", () => {
  it("clear flag allows an empty note, sends none, and keeps a given one", () => {
    const empty = buildClearFlag(target, { note: "" });
    expect(empty.ok && empty.input).not.toHaveProperty("note");
    const given = buildClearFlag(target, { note: "ok" });
    expect(given.ok && given.input).toMatchObject({ action: "clear_flag", note: "ok" });
  });

  it("clear flag sends no approval or state fields", () => {
    const r = buildClearFlag(target, { note: "" });
    expect(r.ok && Object.keys(r.input).sort()).toEqual(["action", "conceptId", "studentId"]);
  });

  it("note requires non-blank text within 2000 characters", () => {
    expect(errorsOf(buildNote(target, { note: "  " }))).toHaveProperty("note");
    expect(errorsOf(buildNote(target, { note: "x".repeat(LIMITS.note + 1) }))).toHaveProperty("note");
    expect(buildNote(target, { note: "x".repeat(LIMITS.note) }).ok).toBe(true);
  });
});

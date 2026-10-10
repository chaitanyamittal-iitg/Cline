import { describe, expect, it } from "vitest";
import { buildAttemptViews } from "./attempts";
import { aiSourceInfo, readingStatusLabel } from "./labels";
import { AnswerRowSchema } from "./types";
import { emptyInputs as base, testAnswer as answer } from "./test-fixtures";

describe("handwriting fields stay separate", () => {
  it("keeps the original path, student-confirmed text and AI reading as three distinct fields", () => {
    const row = answer({
      typed_text: null,
      upload_path: "stu/a-b-1.jpg",
      confirmed_text: "The bulb will not light.",
      interpreted_text: "the bulb will nat light",
      interpreted_by: "mock",
      reading_status: "unclear",
    });
    const view = buildAttemptViews({ ...base, answers: [row] }).attempts[0].items[0].answers[0].answer;
    expect(view.upload_path).toBe("stu/a-b-1.jpg");
    expect(view.confirmed_text).toBe("The bulb will not light.");
    expect(view.interpreted_text).toBe("the bulb will nat light");
    expect(view.confirmed_text).not.toBe(view.interpreted_text);
  });

  it("labels every reading status plainly and never claims an unknown one was read", () => {
    expect(readingStatusLabel("read")).toMatch(/produced a draft/);
    expect(readingStatusLabel("unclear")).toMatch(/could not read/);
    expect(readingStatusLabel("not_read")).toMatch(/did not read/);
    expect(readingStatusLabel(null)).toMatch(/No AI reading status/);
    expect(readingStatusLabel("weird")).toBe("Unrecognised reading status (weird)");
    expect(readingStatusLabel("weird")).not.toMatch(/produced a draft/);
  });

  it("labels a mock reading as MOCK AI, never live", () => {
    expect(aiSourceInfo("mock").label).toBe("MOCK AI");
    expect(aiSourceInfo(null).tone).toBe("unknown");
  });
});

describe("answer row validation (migration 0006 columns)", () => {
  const stored = {
    id: "a", attempt_id: "t", question_id: "q", typed_text: null, upload_path: "s/f.jpg", interpreted_text: null,
    interpreted_by: null, is_correct: null, created_at: "2026-10-10T08:00:00Z",
    kind: "original", clarifies_answer_id: null, confirmed_text: "text", reading_status: "not_read",
  };

  it("accepts a row carrying all four new columns", () => {
    expect(AnswerRowSchema.safeParse(stored).success).toBe(true);
    expect(AnswerRowSchema.safeParse({ ...stored, kind: "clarification", clarifies_answer_id: "x" }).success).toBe(true);
  });

  it("rejects a row missing a new column, so a missing migration shows as a failed section, not wrong data", () => {
    for (const column of ["kind", "clarifies_answer_id", "confirmed_text", "reading_status"] as const) {
      const incomplete: Record<string, unknown> = { ...stored };
      delete incomplete[column];
      expect(AnswerRowSchema.safeParse(incomplete).success, `missing ${column}`).toBe(false);
    }
  });
});

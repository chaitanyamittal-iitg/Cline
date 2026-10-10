import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_TYPES,
  AdvanceProgressRequestSchema,
  MAX_SUPPORT_CYCLES,
  MAX_UPLOAD_BYTES,
  StartMicrotestResponseSchema,
  SubmitAnswersRequestSchema,
  TeacherActionInputSchema,
  UploadFieldsSchema,
} from "./index";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

describe("shared contracts", () => {
  it("caps support cycles at two", () => {
    expect(MAX_SUPPORT_CYCLES).toBe(2);
  });

  it("only lets a student advance to the doubt step through the advance endpoint", () => {
    expect(AdvanceProgressRequestSchema.safeParse({ conceptId: "C3", to: "doubts" }).success).toBe(true);
    expect(AdvanceProgressRequestSchema.safeParse({ conceptId: "C3", to: "passed" }).success).toBe(false);
    expect(AdvanceProgressRequestSchema.safeParse({ conceptId: "C3", to: "microtest" }).success).toBe(false);
  });

  it("rejects an unknown concept id", () => {
    expect(AdvanceProgressRequestSchema.safeParse({ conceptId: "C9", to: "doubts" }).success).toBe(false);
  });

  it("requires at least one answer and a typed or uploaded body for each", () => {
    expect(SubmitAnswersRequestSchema.safeParse({ conceptId: "C3", attemptId: uuid, answers: [] }).success).toBe(false);
    expect(
      SubmitAnswersRequestSchema.safeParse({ conceptId: "C3", attemptId: uuid, answers: [{ questionId: "C3-Q1" }] }).success,
    ).toBe(false);
    expect(
      SubmitAnswersRequestSchema.safeParse({
        conceptId: "C3", attemptId: uuid, answers: [{ questionId: "C3-Q1", typedText: "No path" }],
      }).success,
    ).toBe(true);
  });

  it("never sends answer keys in the student-facing micro-test response", () => {
    const parsed = StartMicrotestResponseSchema.shape.questions.element.shape;
    expect(Object.keys(parsed).sort()).toEqual(["conceptId", "id", "prompt"]);
  });

  it("describes upload limits and fields", () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    expect(ALLOWED_UPLOAD_TYPES).toContain("image/jpeg");
    expect(UploadFieldsSchema.safeParse({ attemptId: uuid, questionId: "C3-Q1" }).success).toBe(true);
  });

  it("limits teacher actions to the agreed list", () => {
    expect(TeacherActionInputSchema.safeParse({ studentId: uuid, conceptId: "C3", action: "approve_next_concept" }).success).toBe(true);
    expect(TeacherActionInputSchema.safeParse({ studentId: uuid, conceptId: "C3", action: "set_score" }).success).toBe(false);
  });
});

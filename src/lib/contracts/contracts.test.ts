import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_TYPES,
  AdvanceProgressRequestSchema,
  DiagnosisReplacementSchema,
  FollowUpRequestSchema,
  HandwritingReadingSchema,
  MAX_CLARIFICATIONS_PER_QUESTION,
  MAX_SUPPORT_CYCLES,
  MAX_UPLOAD_BYTES,
  OverrideDiagnosisPayloadSchema,
  StartMicrotestResponseSchema,
  SubmitAnswersRequestSchema,
  SubmitAnswersResponseSchema,
  TeacherActionInputSchema,
  TeacherActionResponseSchema,
  UploadFieldsSchema,
  UploadResponseSchema,
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

const target = { studentId: uuid, conceptId: "C3" };

describe("teacher action contracts", () => {
  it("requires a note when approving over a student who has not shown understanding", () => {
    const base = { ...target, action: "approve_next_concept" };
    expect(TeacherActionInputSchema.safeParse({ ...base, overrideUnderstanding: true }).success).toBe(false);
    expect(TeacherActionInputSchema.safeParse({ ...base, overrideUnderstanding: true, note: "  " }).success).toBe(false);
    expect(TeacherActionInputSchema.safeParse({ ...base, overrideUnderstanding: true, note: "Ready, shown orally." }).success).toBe(true);
    expect(TeacherActionInputSchema.safeParse({ ...base, overrideUnderstanding: false }).success).toBe(true);
  });

  it("requires an explanatory note and a typed replacement to override a diagnosis", () => {
    const base = {
      ...target, action: "override_diagnosis", diagnosisId: uuid,
      replacement: { isCorrect: true, reasoningSound: true, misconception: null },
    };
    expect(TeacherActionInputSchema.safeParse(base).success).toBe(false);
    expect(TeacherActionInputSchema.safeParse({ ...base, note: "The AI misread the diagram." }).success).toBe(true);
    expect(TeacherActionInputSchema.safeParse({ ...base, note: "x", replacement: { isCorrect: true } }).success).toBe(false);
  });

  it("does not let a replacement call sound work faulty by naming a misconception", () => {
    const bad = DiagnosisReplacementSchema.safeParse({ isCorrect: true, reasoningSound: true, misconception: "None" });
    expect(bad.success).toBe(false);
  });

  it("carries typed teacher support content, and rejects empty content", () => {
    const base = { ...target, action: "assign_support" };
    const support = { explanation: "Trace the loop.", guidingQuestion: null, practiceTask: null, resourceIds: ["C3-R3"] };
    expect(TeacherActionInputSchema.safeParse({ ...base, support }).success).toBe(true);
    expect(TeacherActionInputSchema.safeParse({ ...base }).success).toBe(false);
    expect(TeacherActionInputSchema.safeParse({ ...base, support: { ...support, explanation: "" } }).success).toBe(false);
  });

  it("allows clear_flag without a note and requires one for a plain note", () => {
    expect(TeacherActionInputSchema.safeParse({ ...target, action: "clear_flag" }).success).toBe(true);
    expect(TeacherActionInputSchema.safeParse({ ...target, action: "note" }).success).toBe(false);
    expect(TeacherActionInputSchema.safeParse({ ...target, action: "note", note: "Called home." }).success).toBe(true);
  });

  it("has no field that carries who the actor is", () => {
    const parsed = TeacherActionInputSchema.parse({
      ...target, action: "note", note: "hi", teacherId: uuid, teacher_id: uuid, actor: "someone",
    });
    expect(Object.keys(parsed).sort()).toEqual(["action", "conceptId", "note", "studentId"]);
  });

  it("returns current progress, the next progress or null, and whether anything changed", () => {
    expect(Object.keys(TeacherActionResponseSchema.shape).sort()).toEqual(["alreadyApplied", "nextProgress", "progress"]);
    expect(TeacherActionResponseSchema.shape.nextProgress.safeParse(null).success).toBe(true);
  });

  it("describes what the audit payload keeps of the original diagnosis", () => {
    const payload = {
      diagnosisId: uuid,
      original: { isCorrect: true, reasoningSound: false, misconception: "m", nextAction: "targeted_support", source: "mock" },
      replacement: { isCorrect: true, reasoningSound: true, misconception: null },
      changedFields: ["reasoningSound", "misconception"],
    };
    expect(OverrideDiagnosisPayloadSchema.safeParse(payload).success).toBe(true);
    expect(OverrideDiagnosisPayloadSchema.safeParse({ ...payload, changedFields: [] }).success).toBe(false);
  });
});

describe("handwriting and clarification contracts", () => {
  it("requires the student's confirmed text with an uploaded image, and only then", () => {
    const base = { conceptId: "C3", attemptId: uuid };
    const upload = { questionId: "C3-Q1", uploadPath: "s/x.jpg" };
    expect(SubmitAnswersRequestSchema.safeParse({ ...base, answers: [upload] }).success).toBe(false);
    expect(SubmitAnswersRequestSchema.safeParse({ ...base, answers: [{ ...upload, confirmedText: "No path" }] }).success).toBe(true);
    expect(
      SubmitAnswersRequestSchema.safeParse({ ...base, answers: [{ questionId: "C3-Q1", typedText: "a", confirmedText: "b" }] }).success,
    ).toBe(false);
  });

  it("cannot present a reading that was never made as read text", () => {
    expect(HandwritingReadingSchema.safeParse({ status: "not_read", draftText: null, source: "mock" }).success).toBe(true);
    expect(HandwritingReadingSchema.safeParse({ status: "not_read", draftText: "invented", source: "mock" }).success).toBe(false);
    expect(HandwritingReadingSchema.safeParse({ status: "read", draftText: null, source: "live" }).success).toBe(false);
    expect(HandwritingReadingSchema.safeParse({ status: "unclear", draftText: null, source: "live" }).success).toBe(true);
  });

  it("returns a draft reading, not trusted text, from the upload route", () => {
    expect(Object.keys(UploadResponseSchema.shape).sort()).toEqual(["reading", "uploadPath"]);
  });

  it("lets a result be undecided while a clarification is open, and reports open follow-ups", () => {
    const response = {
      results: [{ questionId: "C3-Q1", isCorrect: null }],
      diagnoses: [],
      progress: { studentId: uuid, conceptId: "C3", state: "analysis", supportCyclesUsed: 0, teacherFlagged: false, teacherClearedToNext: false },
      followUps: [{ questionId: "C3-Q1", question: "What must the current do?" }],
      attemptOutcome: "awaiting_clarification",
    };
    expect(SubmitAnswersResponseSchema.safeParse(response).success).toBe(true);
    expect(SubmitAnswersResponseSchema.safeParse({ ...response, attemptOutcome: "failed" }).success).toBe(false);
  });

  it("resumes the same attempt through a typed follow-up reply, and no numbers appear", () => {
    const req = { conceptId: "C3", attemptId: uuid, questionId: "C3-Q1", response: "The loop must be closed." };
    expect(FollowUpRequestSchema.safeParse(req).success).toBe(true);
    expect(FollowUpRequestSchema.safeParse({ ...req, response: " " }).success).toBe(false);
    expect(MAX_CLARIFICATIONS_PER_QUESTION).toBe(1);
    expect(JSON.stringify(Object.keys(SubmitAnswersResponseSchema.shape))).not.toMatch(/score|mark|percent/i);
  });
});

import { describe, expect, it } from "vitest";
import type { Diagnosis, SubmitAnswersResponse } from "@/lib/contracts";
import { feedbackFromResponse, mergeFollowUpResponse } from "./feedback-model";
import { imageSource } from "./resources";

const STUDENT = "11111111-1111-4111-8111-111111111111";

function diagnosis(over: Partial<Diagnosis> = {}): Diagnosis {
  return {
    conceptId: "C3",
    questionId: "C3-Q1",
    isCorrect: true,
    reasoningSound: true,
    misconception: null,
    evidence: "Mentions a complete path.",
    nextAction: "none",
    followUpQuestion: null,
    source: "mock",
    ...over,
  };
}

function response(over: Partial<SubmitAnswersResponse> = {}): SubmitAnswersResponse {
  return {
    results: [{ questionId: "C3-Q1", isCorrect: true }],
    diagnoses: [diagnosis()],
    progress: {
      studentId: STUDENT,
      conceptId: "C3",
      state: "passed",
      supportCyclesUsed: 0,
      teacherFlagged: false,
      teacherClearedToNext: false,
    },
    followUps: [],
    attemptOutcome: "succeeded",
    ...over,
  };
}

const mine = [{ questionId: "C3-Q1", text: "It stays off", fromPhoto: false, clarification: null }];
const needsClarification = () =>
  response({
    results: [{ questionId: "C3-Q1", isCorrect: null }],
    attemptOutcome: "awaiting_clarification",
    followUps: [{ questionId: "C3-Q1", question: "Why?" }],
  });

describe("feedback model", () => {
  it("keeps isCorrect:null as null", () => {
    const f = feedbackFromResponse(needsClarification(), mine);
    expect(f.results[0].isCorrect).toBeNull();
    expect(f.followUps).toHaveLength(1);
  });

  it("merges a follow-up response: updates the question, takes open follow-ups from the server, records the reply", () => {
    const before = feedbackFromResponse(needsClarification(), mine);
    const after = mergeFollowUpResponse(before, response(), "C3-Q1", "Because there is a gap");
    expect(after.results).toEqual([{ questionId: "C3-Q1", isCorrect: true }]);
    expect(after.followUps).toEqual([]);
    expect(after.attemptOutcome).toBe("succeeded");
    expect(after.yourAnswers[0].clarification).toBe("Because there is a gap");
  });

  it("keeps other questions' results when only one is clarified", () => {
    const before = feedbackFromResponse(
      response({
        results: [
          { questionId: "C3-Q1", isCorrect: null },
          { questionId: "C3-Q2", isCorrect: false },
        ],
        attemptOutcome: "awaiting_clarification",
        followUps: [{ questionId: "C3-Q1", question: "Why?" }],
      }),
      mine,
    );
    const after = mergeFollowUpResponse(
      before,
      response({ results: [{ questionId: "C3-Q1", isCorrect: true }], attemptOutcome: "struggled" }),
      "C3-Q1",
      "reply",
    );
    expect(after.results.find((r) => r.questionId === "C3-Q2")?.isCorrect).toBe(false);
    expect(after.results.find((r) => r.questionId === "C3-Q1")?.isCorrect).toBe(true);
  });
});

describe("imageSource", () => {
  it("allows local paths and https addresses only", () => {
    expect(imageSource("/diagrams/c3-open-circuit.svg")).toBe("/diagrams/c3-open-circuit.svg");
    expect(imageSource("https://example.org/a.png")).toBe("https://example.org/a.png");
  });

  it("refuses everything else", () => {
    const bad = [null, undefined, "", "PLACEHOLDER_VIDEO_URL", "http://example.org/a.png", "//evil.example/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA"];
    for (const value of bad) expect(imageSource(value), String(value)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { getAiProvider } from "./index";
import {
  AnswerInputSchema,
  DiagnosisSchema,
  HandwritingReadingSchema,
  ReassessmentSchema,
  SupportPlanSchema,
} from "@/lib/contracts";
import { LiveAiNotConfiguredError } from "./providers/live";

const baseInput = {
  conceptId: "C3" as const,
  questionId: "C3-Q1",
  questionPrompt: "Will the bulb light?",
  expectedIdea: "No, needs a complete path",
  knownMisconceptions: [],
  earlierEvidence: [],
  approvedResources: [],
};

describe("mock AI provider", () => {
  const ai = getAiProvider("mock");

  it("is labelled as mock", () => {
    expect(ai.source).toBe("mock");
    expect(ai.label).toBe("MOCK AI");
  });

  it("defaults to mock when the setting is missing", () => {
    expect(getAiProvider(undefined).source).toBe("mock");
  });

  it("marks a wrong answer wrong and returns a valid diagnosis", async () => {
    const d = await ai.diagnose({ ...baseInput, studentAnswer: "Yes it lights with one wire" });
    expect(DiagnosisSchema.parse(d).isCorrect).toBe(false);
    expect(d.source).toBe("mock");
  });

  it("flags a correct answer with missing reasoning", async () => {
    const d = await ai.diagnose({ ...baseInput, studentAnswer: "No" });
    expect(d.isCorrect).toBe(true);
    expect(d.reasoningSound).toBe(false);
  });

  it("never pretends to read a handwritten image", async () => {
    const out = await ai.interpretHandwriting({
      imageBytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      questionPrompt: "Will the bulb light?",
    });
    expect(HandwritingReadingSchema.parse(out.reading)).toEqual({ status: "not_read", draftText: null, source: "mock" });
  });

  it("returns valid support and reassessment shapes", async () => {
    const d = await ai.diagnose({ ...baseInput, studentAnswer: "Yes it lights" });
    const support = await ai.createSupport({ conceptId: "C3", cycleNumber: 1, diagnoses: [d], approvedResources: [] });
    const re = await ai.createReassessment({ conceptId: "C3", cycleNumber: 1, diagnoses: [d], previousPrompts: [], approvedResources: [] });
    expect(SupportPlanSchema.parse(support).source).toBe("mock");
    expect(ReassessmentSchema.parse(re).questions.length).toBeGreaterThan(0);
  });
});

describe("live AI provider stub", () => {
  it("refuses to fake output when not implemented", () => {
    const ai = getAiProvider("live");
    expect(ai.source).toBe("live");
    expect(() => ai.diagnose({ ...baseInput, studentAnswer: "x" })).toThrow(LiveAiNotConfiguredError);
  });
});

describe("answer contract", () => {
  it("requires typed text or an upload", () => {
    expect(AnswerInputSchema.safeParse({ questionId: "C3-Q1" }).success).toBe(false);
    expect(AnswerInputSchema.safeParse({ questionId: "C3-Q1", typedText: "No" }).success).toBe(true);
    expect(AnswerInputSchema.safeParse({ questionId: "C3-Q1", uploadPath: "abc/x.jpg", confirmedText: "No" }).success).toBe(true);
  });
});

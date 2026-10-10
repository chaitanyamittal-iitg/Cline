// MOCK AI provider. Deterministic, rule-based fake output for development and tests.
// Every result carries source: "mock" and the UI must show a "MOCK AI" badge.
// It is NOT a language model and must never be presented as live AI.
import type { Diagnosis, Reassessment, SupportPlan } from "@/lib/contracts";
import type {
  AiProvider,
  DiagnoseInput,
  HomeworkInput,
  HomeworkOutput,
  InterpretHandwritingInput,
  InterpretHandwritingOutput,
  ReassessmentInput,
  SupportInput,
  TutorInput,
  TutorOutput,
} from "../types";

const has = (text: string, ...words: string[]) => words.some((w) => text.toLowerCase().includes(w));

export class MockAiProvider implements AiProvider {
  readonly label = "MOCK AI";
  readonly source = "mock" as const;

  async answerDoubt(input: TutorInput): Promise<TutorOutput> {
    const visual = input.approvedResources.find((r) => r.kind === "diagram" || r.kind === "video");
    const reading = input.approvedResources.find((r) => r.kind === "reading");
    return {
      reply: `[MOCK AI] ${reading?.body ?? "Please re-read the lesson."} (You asked: "${input.studentMessage}")`,
      resourceId: visual?.id ?? null,
      source: "mock",
    };
  }

  /** The mock cannot read images, and says so. The student types what the handwriting says instead. */
  async interpretHandwriting(_input: InterpretHandwritingInput): Promise<InterpretHandwritingOutput> {
    void _input;
    return { reading: { status: "not_read", draftText: null, source: "mock" } };
  }

  async diagnose(input: DiagnoseInput): Promise<Diagnosis> {
    // A clarification is read together with the first answer (contract: DiagnoseInput.clarification).
    const a = input.clarification ? `${input.studentAnswer} ${input.clarification}` : input.studentAnswer;
    const base = { conceptId: input.conceptId, questionId: input.questionId, source: "mock" as const };

    if (input.conceptId === "C3") {
      const saysNo = has(a, "no", "not light", "won't", "will not", "stay off");
      const mentionsPath = has(a, "complete", "closed", "return", "loop", "path", "both terminal", "negative");
      if (saysNo && mentionsPath) {
        return { ...base, isCorrect: true, reasoningSound: true, misconception: null,
          evidence: "Answer is correct and mentions a complete path.", nextAction: "none", followUpQuestion: null };
      }
      if (saysNo && !mentionsPath) {
        return { ...base, isCorrect: true, reasoningSound: false,
          misconception: "Right conclusion without explaining the complete path.",
          evidence: "Student says the bulb will not light but gives no reason about the path.",
          nextAction: "follow_up_question", followUpQuestion: "What does the current need in order to flow around the circuit?" };
      }
      return { ...base, isCorrect: false, reasoningSound: false,
        misconception: "Student does not yet understand that a complete conducting path is required.",
        evidence: "The student expects the bulb to light without a return path.",
        nextAction: "targeted_support", followUpQuestion: null };
    }

    if (input.conceptId === "C2" && has(a, "will light", "yes", "plastic conducts")) {
      return { ...base, isCorrect: false, reasoningSound: false,
        misconception: "Student confuses conductors and insulators.",
        evidence: "The student treats an insulating material as if it carries current.",
        nextAction: "targeted_support", followUpQuestion: null };
    }

    const looksGood = a.trim().length > 20;
    return { ...base, isCorrect: looksGood, reasoningSound: looksGood,
      misconception: looksGood ? null : "Answer too short to judge reasoning.",
      evidence: looksGood ? "Answer is reasonably complete." : "Very little working shown.",
      nextAction: looksGood ? "none" : "follow_up_question",
      followUpQuestion: looksGood ? null : "Can you explain your thinking in a sentence or two?" };
  }

  async createSupport(input: SupportInput): Promise<SupportPlan> {
    const gap = input.diagnoses.find((d) => d.misconception)?.misconception ?? "a gap in understanding";
    const diagrams = input.approvedResources.filter((r) => r.kind === "diagram").map((r) => r.id);
    return {
      conceptId: input.conceptId, cycleNumber: input.cycleNumber, targetMisconception: gap,
      explanation: `[MOCK AI] Cycle ${input.cycleNumber}: let us fix this idea: ${gap}`,
      guidingQuestion: "[MOCK AI] Trace the path of the current with your finger. Where does it start and where must it end?",
      practiceTask: "[MOCK AI] Draw a circuit that lights the bulb, then draw the same circuit with one gap.",
      resourceIds: diagrams.slice(0, 2), source: "mock",
    };
  }

  async createReassessment(input: ReassessmentInput): Promise<Reassessment> {
    const n = input.cycleNumber;
    return {
      conceptId: input.conceptId, cycleNumber: n, source: "mock",
      questions: [{
        id: `${input.conceptId}-RE${n}-1`,
        prompt: `[MOCK AI] Fresh question ${n}: a bulb, a cell and a wire form a loop with one small gap. Will the bulb light? Explain.`,
        expectedIdea: "A gap breaks the path, so no current flows and the bulb stays off.",
      }],
    };
  }

  async createHomework(input: HomeworkInput): Promise<HomeworkOutput> {
    const gaps = input.diagnoses.filter((d) => d.misconception);
    const items = (gaps.length ? gaps : input.diagnoses.slice(0, 1)).map((d, i) => ({
      conceptId: d.conceptId,
      prompt: `[MOCK AI] Homework ${i + 1}: in your own words, explain ${d.misconception ?? "what you learned today"}.`,
    }));
    return { items, source: "mock" };
  }
}

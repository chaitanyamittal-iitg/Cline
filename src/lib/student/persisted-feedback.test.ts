import { describe, expect, it } from "vitest";
import { buildPersistedFeedback, type PersistedAnswerRow, type PersistedDiagnosisRow } from "./persisted-feedback";

const questions = [
  { id: "C3-Q1", prompt: "Q1?" },
  { id: "C3-Q2", prompt: "Q2?" },
];

function answer(over: Partial<PersistedAnswerRow> & { id: string; question_id: string }): PersistedAnswerRow {
  return { kind: "original", clarifies_answer_id: null, typed_text: "my answer", confirmed_text: null, upload_path: null, ...over };
}

function diag(answerId: string, over: Partial<PersistedDiagnosisRow> = {}): PersistedDiagnosisRow {
  return {
    answer_id: answerId,
    concept_id: "C3",
    is_correct: true,
    reasoning_sound: true,
    misconception: null,
    evidence: "Good.",
    next_action: "none",
    follow_up_question: null,
    ai_source: "mock",
    created_at: "2026-10-10T10:00:00Z",
    ...over,
  };
}

const unclear = { is_correct: true, reasoning_sound: false, next_action: "follow_up_question", follow_up_question: "Why?" };
const gap = { is_correct: false, reasoning_sound: false, next_action: "targeted_support" };

describe("buildPersistedFeedback", () => {
  it("returns null when nothing has been answered yet", () => {
    expect(buildPersistedFeedback(questions, [], [])).toBeNull();
  });

  it("rebuilds a successful sitting", () => {
    const f = buildPersistedFeedback(questions, [answer({ id: "a1", question_id: "C3-Q1" }), answer({ id: "a2", question_id: "C3-Q2" })], [diag("a1"), diag("a2")]);
    expect(f?.attemptOutcome).toBe("succeeded");
    expect(f?.results.every((r) => r.isCorrect === true)).toBe(true);
  });

  it("restores an open clarification with isCorrect:null after a refresh", () => {
    const f = buildPersistedFeedback(questions, [answer({ id: "a1", question_id: "C3-Q1" })], [diag("a1", unclear)]);
    expect(f?.attemptOutcome).toBe("awaiting_clarification");
    expect(f?.results[0].isCorrect).toBeNull();
    expect(f?.followUps).toEqual([{ questionId: "C3-Q1", question: "Why?" }]);
  });

  it("after a clarification that fixed things, the sitting succeeds", () => {
    const answers = [answer({ id: "a1", question_id: "C3-Q1" }), answer({ id: "c1", question_id: "C3-Q1", kind: "clarification", clarifies_answer_id: "a1", typed_text: "because of the gap" })];
    const f = buildPersistedFeedback(questions, answers, [diag("a1", unclear), diag("c1", { created_at: "2026-10-10T10:05:00Z" })]);
    expect(f?.attemptOutcome).toBe("succeeded");
    expect(f?.followUps).toEqual([]);
    expect(f?.yourAnswers[0].clarification).toBe("because of the gap");
  });

  it("a question still unclear after its clarification goes to the teacher, not to failure", () => {
    const answers = [answer({ id: "a1", question_id: "C3-Q1" }), answer({ id: "c1", question_id: "C3-Q1", kind: "clarification", clarifies_answer_id: "a1" })];
    const f = buildPersistedFeedback(questions, answers, [diag("a1", unclear), diag("c1", { ...unclear, created_at: "2026-10-10T10:05:00Z" })]);
    expect(f?.attemptOutcome).toBe("unclear_needs_teacher");
  });

  it("a clear gap wins over a clarification that is still open elsewhere only after clarifications are done", () => {
    const open = buildPersistedFeedback(questions, [answer({ id: "a1", question_id: "C3-Q1" }), answer({ id: "a2", question_id: "C3-Q2" })], [diag("a1", unclear), diag("a2", gap)]);
    expect(open?.attemptOutcome).toBe("awaiting_clarification");
    const done = buildPersistedFeedback(questions, [answer({ id: "a1", question_id: "C3-Q1" }), answer({ id: "a2", question_id: "C3-Q2" })], [diag("a1", gap), diag("a2", gap)]);
    expect(done?.attemptOutcome).toBe("struggled");
  });

  it("a correct answer with faulty reasoning and no follow-up is a clear gap", () => {
    const f = buildPersistedFeedback(questions, [answer({ id: "a1", question_id: "C3-Q1" })], [diag("a1", { reasoning_sound: false, next_action: "targeted_support" })]);
    expect(f?.attemptOutcome).toBe("struggled");
  });

  it("shows no verdict, and no outcome, for an answer that has no diagnosis yet", () => {
    const f = buildPersistedFeedback(questions, [answer({ id: "a1", question_id: "C3-Q1" })], []);
    expect(f?.results[0].isCorrect).toBeNull();
    expect(f?.attemptOutcome).toBeNull();
  });

  it("marks a photo answer and uses the confirmed text", () => {
    const f = buildPersistedFeedback(questions, [answer({ id: "a1", question_id: "C3-Q1", typed_text: null, confirmed_text: "from my photo", upload_path: "s/x.png" })], [diag("a1")]);
    expect(f?.yourAnswers[0]).toMatchObject({ text: "from my photo", fromPhoto: true });
  });

  it("keeps the order of the questions", () => {
    const f = buildPersistedFeedback(questions, [answer({ id: "a2", question_id: "C3-Q2" }), answer({ id: "a1", question_id: "C3-Q1" })], [diag("a1"), diag("a2")]);
    expect(f?.results.map((r) => r.questionId)).toEqual(["C3-Q1", "C3-Q2"]);
  });
});

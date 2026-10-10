import { describe, expect, it } from "vitest";
import { assessAttempt, FALLBACK_FOLLOW_UP, toSubmitResponse, type SavedAnswerRow, type SavedDiagnosisRow } from "./assess";

const Q = ["C3-Q1", "C3-Q2"];
const studentId = "123e4567-e89b-42d3-a456-426614174000";
const progress = { studentId, conceptId: "C3" as const, state: "analysis" as const, supportCyclesUsed: 0, teacherFlagged: false, teacherClearedToNext: false };

const original = (id: string, q: string): SavedAnswerRow => ({ id, question_id: q, kind: "original", clarifies_answer_id: null, typed_text: "x", confirmed_text: null, upload_path: null });
const clarification = (id: string, q: string, of: string): SavedAnswerRow => ({ id, question_id: q, kind: "clarification", clarifies_answer_id: of, typed_text: "more", confirmed_text: null, upload_path: null });

type Kind = "sound" | "wrong" | "faulty" | "unclear";
function diag(answerId: string, kind: Kind, createdAt = "2026-01-01T00:00:00Z"): SavedDiagnosisRow {
  const base = { answer_id: answerId, concept_id: "C3", evidence: "e", ai_source: "mock", created_at: createdAt, misconception: null, follow_up_question: null };
  switch (kind) {
    case "sound": return { ...base, is_correct: true, reasoning_sound: true, next_action: "none" };
    case "wrong": return { ...base, is_correct: false, reasoning_sound: false, misconception: "m", next_action: "targeted_support" };
    case "faulty": return { ...base, is_correct: true, reasoning_sound: false, misconception: "m", next_action: "targeted_support" };
    case "unclear": return { ...base, is_correct: true, reasoning_sound: false, misconception: "m", next_action: "follow_up_question", follow_up_question: "Why?" };
  }
}

describe("assessAttempt", () => {
  it("succeeds only when every answer is correct with sound reasoning", () => {
    const a = assessAttempt(Q, [original("a1", "C3-Q1"), original("a2", "C3-Q2")], [diag("a1", "sound"), diag("a2", "sound")]);
    expect(a.outcome).toBe("succeeded");
    expect(a.results).toEqual([{ questionId: "C3-Q1", isCorrect: true }, { questionId: "C3-Q2", isCorrect: true }]);
  });

  it("treats a correct answer with faulty reasoning as a gap, not a success", () => {
    const a = assessAttempt(Q, [original("a1", "C3-Q1"), original("a2", "C3-Q2")], [diag("a1", "faulty"), diag("a2", "sound")]);
    expect(a.outcome).toBe("struggled");
  });

  it("holds an unclear answer open with no verdict and a follow-up question, never 'wrong'", () => {
    const a = assessAttempt(Q, [original("a1", "C3-Q1"), original("a2", "C3-Q2")], [diag("a1", "unclear"), diag("a2", "sound")]);
    expect(a.outcome).toBe("awaiting_clarification");
    expect(a.results[0]).toEqual({ questionId: "C3-Q1", isCorrect: null });
    expect(a.followUps).toEqual([{ questionId: "C3-Q1", question: "Why?" }]);
  });

  it("uses a standard question when the AI asked for a follow-up without one", () => {
    const row = { ...diag("a1", "unclear"), follow_up_question: null };
    const a = assessAttempt(["C3-Q1"], [original("a1", "C3-Q1")], [row]);
    expect(a.followUps[0].question).toBe(FALLBACK_FOLLOW_UP);
  });

  it("judges a clarified question on the NEW diagnosis, and keeps the original diagnosis on file", () => {
    const answers = [original("a1", "C3-Q1"), clarification("c1", "C3-Q1", "a1")];
    const diagnoses = [diag("a1", "unclear"), diag("c1", "sound", "2026-01-02T00:00:00Z")];
    const a = assessAttempt(["C3-Q1"], answers, diagnoses);
    expect(a.outcome).toBe("succeeded");
    expect(a.followUps).toEqual([]);
    expect(diagnoses).toHaveLength(2);
  });

  it("sends work that is STILL unclear after the clarification to the teacher, not to failure", () => {
    const answers = [original("a1", "C3-Q1"), clarification("c1", "C3-Q1", "a1")];
    const a = assessAttempt(["C3-Q1"], answers, [diag("a1", "unclear"), diag("c1", "unclear", "2026-01-02T00:00:00Z")]);
    expect(a.outcome).toBe("unclear_needs_teacher");
    expect(a.results[0].isCorrect).not.toBeNull();
  });

  it("a clear gap still counts when another question needs a clarification only after that one is answered", () => {
    const a = assessAttempt(Q, [original("a1", "C3-Q1"), original("a2", "C3-Q2")], [diag("a1", "wrong"), diag("a2", "unclear")]);
    expect(a.outcome).toBe("awaiting_clarification");
  });

  it("gives no outcome for an incomplete sitting or an unreadable saved diagnosis", () => {
    expect(assessAttempt(Q, [original("a1", "C3-Q1")], [diag("a1", "sound")]).outcome).toBeNull();
    const broken = { ...diag("a1", "sound"), next_action: "nonsense" };
    const a = assessAttempt(["C3-Q1"], [original("a1", "C3-Q1")], [broken]);
    expect(a.outcome).toBeNull();
    expect(a.results[0].isCorrect).toBeNull();
    expect(toSubmitResponse(a, progress)).toBeNull();
  });

  it("builds a response that matches the contract, with no number anywhere", () => {
    const a = assessAttempt(["C3-Q1"], [original("a1", "C3-Q1")], [diag("a1", "wrong")]);
    const response = toSubmitResponse(a, progress);
    expect(response?.attemptOutcome).toBe("struggled");
    expect(JSON.stringify(response)).not.toMatch(/score|mark/i);
  });
});

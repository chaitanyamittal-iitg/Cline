import { describe, expect, it } from "vitest";
import { buildAttemptViews, findUnlinkedDiagnoses } from "./attempts";
import type { AnswerRow, AttemptRow, DiagnosisRow, SupportCycleRow } from "./types";

const attempt = (over: Partial<AttemptRow>): AttemptRow => ({
  id: "at1",
  concept_id: "C3",
  kind: "microtest",
  cycle: 0,
  questions: [{ id: "C3-Q1", prompt: "Will the bulb light?\nExplain." }],
  ai_source: null,
  created_at: "2026-10-10T08:00:00Z",
  ...over,
});
const answer = (over: Partial<AnswerRow>): AnswerRow => ({
  id: "an1",
  attempt_id: "at1",
  question_id: "C3-Q1",
  typed_text: "no, because\nthe path is open",
  upload_path: null,
  interpreted_text: null,
  interpreted_by: null,
  is_correct: false,
  created_at: "2026-10-10T08:05:00Z",
  ...over,
});
const diagnosis = (over: Partial<DiagnosisRow>): DiagnosisRow => ({
  id: "d1",
  answer_id: "an1",
  concept_id: "C3",
  is_correct: true,
  reasoning_sound: false,
  misconception: "lucky guess",
  evidence: "e",
  next_action: "follow_up_question",
  follow_up_question: "Why?",
  ai_source: "mock",
  created_at: "2026-10-10T08:06:00Z",
  ...over,
});
const empty = { diagnoses: [], questionBank: [], supportCycles: [] };

describe("buildAttemptViews", () => {
  it("attaches answers and diagnoses only through real foreign keys", () => {
    const { attempts } = buildAttemptViews({
      attempts: [attempt({})],
      answers: [answer({}), answer({ id: "an2", question_id: "C3-Q2" })],
      diagnoses: [diagnosis({}), diagnosis({ id: "d2", answer_id: "an2" })],
      questionBank: [],
      supportCycles: [],
    });
    const [first, second] = attempts[0].items;
    expect(first.questionId).toBe("C3-Q1");
    expect(first.answers[0].diagnoses.map((d) => d.id)).toEqual(["d1"]);
    // An answer to a question the attempt does not list is still shown, with its own diagnosis only.
    expect(second.questionId).toBe("C3-Q2");
    expect(second.answers[0].diagnoses.map((d) => d.id)).toEqual(["d2"]);
  });

  it("does not pair records that merely share a concept or are close in time", () => {
    const { attempts } = buildAttemptViews({
      attempts: [attempt({})],
      answers: [answer({})],
      diagnoses: [diagnosis({ id: "d9", answer_id: null }), diagnosis({ id: "d8", answer_id: "someone-else" })],
      questionBank: [],
      supportCycles: [],
    });
    expect(attempts[0].items[0].answers[0].diagnoses).toEqual([]);
  });

  it("keeps original wording and line breaks; the question bank is used only when no prompt was stored", () => {
    const { attempts } = buildAttemptViews({
      attempts: [attempt({ questions: [{ id: "C3-Q1", prompt: "Stored prompt\nline two" }, { id: "C3-Q2" }] })],
      answers: [answer({})],
      diagnoses: [],
      questionBank: [
        { id: "C3-Q1", concept_id: "C3", prompt: "BANK should not win" },
        { id: "C3-Q2", concept_id: "C3", prompt: "Bank prompt" },
      ],
      supportCycles: [],
    });
    const [q1, q2] = attempts[0].items;
    expect(q1.prompt).toBe("Stored prompt\nline two");
    expect(q1.promptOrigin).toBe("attempt");
    expect(q1.answers[0].answer.typed_text).toBe("no, because\nthe path is open");
    expect(q2.prompt).toBe("Bank prompt");
    expect(q2.promptOrigin).toBe("question_bank");
  });

  it("reports a missing prompt as missing, not as an empty string", () => {
    const { attempts } = buildAttemptViews({
      attempts: [attempt({ questions: [{ id: "Q-gone" }] })],
      answers: [],
      ...empty,
    });
    expect(attempts[0].items[0].prompt).toBeNull();
    expect(attempts[0].items[0].promptOrigin).toBeNull();
  });

  it("separates answers whose attempt is not loaded and never attaches them elsewhere", () => {
    const { attempts, orphanAnswers } = buildAttemptViews({
      attempts: [attempt({})],
      answers: [answer({ id: "anX", attempt_id: "other-attempt" })],
      ...empty,
    });
    expect(attempts[0].items[0].answers).toEqual([]);
    expect(orphanAnswers.map((a) => a.answer.id)).toEqual(["anX"]);
  });

  it("links a reassessment attempt to its support cycle by reassessment_attempt_id only", () => {
    const cycle: SupportCycleRow = {
      id: "cy1",
      concept_id: "C3",
      cycle_number: 1,
      diagnosis_id: null,
      support: {},
      reassessment_attempt_id: "at2",
      outcome: "pending",
      ai_source: "mock",
      created_at: "2026-10-10T09:00:00Z",
    };
    const { attempts } = buildAttemptViews({
      attempts: [attempt({}), attempt({ id: "at2", kind: "reassessment", cycle: 1, created_at: "2026-10-10T10:00:00Z" })],
      answers: [],
      diagnoses: [],
      questionBank: [],
      supportCycles: [cycle],
    });
    expect(attempts[0].supportCycle).toBeNull();
    expect(attempts[1].supportCycle?.id).toBe("cy1");
  });

  it("orders attempts oldest first, with a stable tie-break", () => {
    const { attempts } = buildAttemptViews({
      attempts: [attempt({ id: "b", created_at: "2026-10-10T09:00:00Z" }), attempt({ id: "a", created_at: "2026-10-10T08:00:00Z" })],
      answers: [],
      ...empty,
    });
    expect(attempts.map((a) => a.attempt.id)).toEqual(["a", "b"]);
  });
});

describe("findUnlinkedDiagnoses", () => {
  const rows = [
    diagnosis({ id: "a-none", answer_id: null }),
    diagnosis({ id: "b-dangling", answer_id: "missing" }),
    diagnosis({ id: "c-linked", answer_id: "an1" }),
  ];

  it("lists diagnoses with no answer link or a dangling link, each with its reason", () => {
    const out = findUnlinkedDiagnoses(rows, [answer({})]);
    expect(out.map((o) => [o.diagnosis.id, o.reason])).toEqual([
      ["a-none", "no_answer_link"],
      ["b-dangling", "answer_not_found"],
    ]);
  });

  it("says answers were unavailable when they could not be loaded, instead of calling them missing", () => {
    const out = findUnlinkedDiagnoses(rows, null);
    expect(out.map((o) => o.reason)).toEqual(["no_answer_link", "answers_unavailable", "answers_unavailable"]);
  });
});

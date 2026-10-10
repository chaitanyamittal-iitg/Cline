import { describe, expect, it } from "vitest";
import { buildAttemptViews } from "./attempts";
import { emptyInputs as base, testAnswer as answer, testAttempt as attempt, testDiagnosis as diagnosis } from "./test-fixtures";

describe("clarification replies (answers.clarifies_answer_id)", () => {
  it("nests a reply beneath the answer it names, keeping the original untouched", () => {
    const reply = answer({ id: "an2", kind: "clarification", clarifies_answer_id: "an1", typed_text: "I meant the loop is open", created_at: "2026-10-10T08:10:00Z" });
    const out = buildAttemptViews({ ...base, answers: [answer({}), reply] });
    const [item] = out.attempts[0].items;
    expect(item.answers).toHaveLength(1);
    expect(item.answers[0].answer.typed_text).toBe("it depends");
    expect(item.answers[0].clarifications.map((c) => c.answer.id)).toEqual(["an2"]);
    expect(item.answers[0].clarifications[0].answer.typed_text).toBe("I meant the loop is open");
  });

  it("never lists a clarification as a second original answer or as an orphan", () => {
    const out = buildAttemptViews({
      ...base,
      answers: [answer({}), answer({ id: "an2", kind: "clarification", clarifies_answer_id: "an1" })],
    });
    expect(out.attempts[0].items[0].answers).toHaveLength(1);
    expect(out.orphanAnswers).toEqual([]);
    expect(out.unlinkedClarifications).toEqual([]);
  });

  it("attaches a reply only to the answer it names, even for the same question in another attempt", () => {
    const otherAttempt = { ...attempt, id: "at2", created_at: "2026-10-10T09:00:00Z" };
    const out = buildAttemptViews({
      ...base,
      attempts: [attempt, otherAttempt],
      answers: [
        answer({}),
        answer({ id: "anB", attempt_id: "at2", created_at: "2026-10-10T09:05:00Z" }),
        answer({ id: "anR", kind: "clarification", clarifies_answer_id: "anB", created_at: "2026-10-10T09:10:00Z" }),
      ],
    });
    expect(out.attempts[0].items[0].answers[0].clarifications).toEqual([]);
    expect(out.attempts[1].items[0].answers[0].clarifications.map((c) => c.answer.id)).toEqual(["anR"]);
  });

  it("returns a reply whose original is missing separately, never attached by guess", () => {
    const out = buildAttemptViews({
      ...base,
      answers: [answer({}), answer({ id: "anX", kind: "clarification", clarifies_answer_id: "gone" })],
    });
    expect(out.attempts[0].items[0].answers[0].clarifications).toEqual([]);
    expect(out.unlinkedClarifications.map((c) => c.answer.id)).toEqual(["anX"]);
  });

  it("treats a clarification with no link as unlinked, not as an answer", () => {
    const out = buildAttemptViews({ ...base, answers: [answer({ id: "anY", kind: "clarification", clarifies_answer_id: null })] });
    expect(out.unlinkedClarifications.map((c) => c.answer.id)).toEqual(["anY"]);
    expect(out.attempts[0].items.every((i) => i.answers.length === 0)).toBe(true);
  });

  it("keeps each diagnosis with the row it is linked to: original and reply separately", () => {
    const out = buildAttemptViews({
      ...base,
      answers: [answer({}), answer({ id: "an2", kind: "clarification", clarifies_answer_id: "an1" })],
      diagnoses: [diagnosis({ id: "dOrig", answer_id: "an1" }), diagnosis({ id: "dReply", answer_id: "an2", next_action: "none", follow_up_question: null })],
    });
    const original = out.attempts[0].items[0].answers[0];
    expect(original.diagnoses.map((d) => d.id)).toEqual(["dOrig"]);
    expect(original.clarifications[0].diagnoses.map((d) => d.id)).toEqual(["dReply"]);
  });

  it("orders several replies oldest first", () => {
    const out = buildAttemptViews({
      ...base,
      answers: [
        answer({}),
        answer({ id: "late", kind: "clarification", clarifies_answer_id: "an1", created_at: "2026-10-10T08:30:00Z" }),
        answer({ id: "early", kind: "clarification", clarifies_answer_id: "an1", created_at: "2026-10-10T08:10:00Z" }),
      ],
    });
    expect(out.attempts[0].items[0].answers[0].clarifications.map((c) => c.answer.id)).toEqual(["early", "late"]);
  });
});

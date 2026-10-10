import { describe, expect, it } from "vitest";
import { buildProgressViews, collectQuestionIds, parseAttemptQuestions } from "./linking";
import type { AnswerRow, AttemptRow, ConceptRow, ProgressRow } from "./types";

const concepts: ConceptRow[] = [
  { id: "C2", position: 2, title: "Conducting materials" },
  { id: "C3", position: 3, title: "Complete circuits" },
];
const progress = (concept_id: string): ProgressRow => ({
  student_id: "s",
  concept_id,
  state: "lesson",
  support_cycles_used: 0,
  teacher_flagged: false,
  teacher_cleared_to_next: false,
});

describe("buildProgressViews", () => {
  it("orders concepts by position and invents no progress", () => {
    expect(buildProgressViews([progress("C3"), progress("C2")], concepts).map((p) => p.conceptId)).toEqual(["C2", "C3"]);
    expect(buildProgressViews([], concepts)).toEqual([]);
  });

  it("keeps state, attention flag and approval as separate stored facts", () => {
    const [view] = buildProgressViews(
      [{ ...progress("C3"), state: "passed", teacher_flagged: true, teacher_cleared_to_next: false }],
      concepts,
    );
    expect(view).toMatchObject({ state: "passed", teacherFlagged: true, teacherClearedToNext: false });
  });

  it("falls back to the concept id as the title when titles are unavailable", () => {
    expect(buildProgressViews([progress("C3")], null)[0].conceptTitle).toBe("C3");
  });

  it("does not choose a current concept: every row is kept", () => {
    expect(buildProgressViews([progress("C2"), progress("C3")], concepts)).toHaveLength(2);
  });
});

describe("question id helpers", () => {
  it("parses stored question lists defensively", () => {
    expect(parseAttemptQuestions("nope")).toEqual([]);
    expect(parseAttemptQuestions([{ id: "a", prompt: "p" }, { prompt: "no id" }, 5, null])).toEqual([{ id: "a", prompt: "p" }]);
    expect(parseAttemptQuestions([{ id: "a" }])).toEqual([{ id: "a", prompt: null }]);
  });

  it("collects each mentioned question id once", () => {
    const attempt = { questions: [{ id: "Q1", prompt: "x" }] } as AttemptRow;
    const answers = [{ question_id: "Q1" }, { question_id: "Q2" }] as AnswerRow[];
    expect(collectQuestionIds([attempt], answers).sort()).toEqual(["Q1", "Q2"]);
  });
});

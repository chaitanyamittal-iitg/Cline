// Stage 1 answers, retry and follow-up checks, over real HTTP with real signed-in sessions. Called by stage1-http.ts.
import { check, listOf, post, type Session } from "./http-lib";

const LEAKS = /expectedIdea|expected_idea|common_misconceptions/;
const GOOD = "No, the bulb will not light because the circuit is not complete: there is no closed path back to the negative terminal.";

type Submit = {
  attemptOutcome?: string;
  followUps?: { questionId: string }[];
  results?: { isCorrect: boolean | null }[];
  progress?: { state: string; supportCyclesUsed: number; teacherClearedToNext: boolean };
};

export async function answerChecks(a: Session, b: Session, bId: string, attemptId: string, questions: { id: string }[]) {
  // Ownership: Student A cannot touch Student B's attempt.
  const some = questions.map((q) => ({ questionId: q.id, typedText: "x" }));
  const stolen = await post("/api/answers", { conceptId: "C3", attemptId, answers: some }, a);
  check("ownership: another student cannot submit to this attempt (404)", stolen.status === 404, `status ${stolen.status}`);
  const stolenFollow = await post("/api/answers/follow-up", { conceptId: "C3", attemptId, questionId: questions[0].id, response: "x" }, a);
  check("ownership: another student cannot answer its follow-up (404)", stolenFollow.status === 404, `status ${stolenFollow.status}`);

  // Q1 "No" is right but gives no reasoning -> a clarification, not a failure.
  const answers = [
    { questionId: questions[0].id, typedText: "No" },
    { questionId: questions[1].id, typedText: GOOD },
    { questionId: questions[2].id, typedText: GOOD },
  ];
  const r1 = await post("/api/answers", { conceptId: "C3", attemptId, answers }, b);
  const d1 = r1.json?.data as Submit | undefined;
  check("answers: right answer with no reasoning waits for a clarification", r1.status === 200 && d1?.attemptOutcome === "awaiting_clarification" && d1.followUps?.length === 1, `status ${r1.status} ${r1.json?.error ?? ""}`);
  check("answers: that question has NO verdict yet (null), never 'wrong'", d1?.results?.[0]?.isCorrect === null);
  check("answers: state is 'analysis' and NO cycle was used", d1?.progress?.state === "analysis" && d1.progress.supportCyclesUsed === 0);
  check("answers: no answer key and no number in the response", !LEAKS.test(r1.raw) && !/score|marks/i.test(r1.raw));
  const r1b = await post("/api/answers", { conceptId: "C3", attemptId, answers }, b);
  const saved = await b.db.from("answers").select("id, kind").eq("attempt_id", attemptId);
  check("retry: submitting again returns the saved result and adds no rows", r1b.status === 200 && listOf(saved.data).filter((r) => r.kind === "original").length === 3, `rows ${listOf(saved.data).length}`);

  // Follow-up: refused where nothing is open, accepted where it is.
  const notOpen = await post("/api/answers/follow-up", { conceptId: "C3", attemptId, questionId: questions[1].id, response: "more" }, b);
  check("follow-up: a question with no open clarification is refused (409)", notOpen.status === 409, `status ${notOpen.status}`);
  const reply = "The current needs a complete closed path from one terminal to the other.";
  const f1 = await post("/api/answers/follow-up", { conceptId: "C3", attemptId, questionId: questions[0].id, response: reply }, b);
  const fd = f1.json?.data as Submit | undefined;
  check("follow-up: the SAME attempt resumes and succeeds", f1.status === 200 && fd?.attemptOutcome === "succeeded", `status ${f1.status} ${f1.json?.error ?? ""}`);
  check("follow-up: 'passed', no cycle used, and passing did NOT approve the next concept", fd?.progress?.state === "passed" && fd.progress.supportCyclesUsed === 0 && fd.progress.teacherClearedToNext === false);
  const f2 = await post("/api/answers/follow-up", { conceptId: "C3", attemptId, questionId: questions[0].id, response: "again" }, b);
  const after = await b.db.from("answers").select("id, kind, typed_text, question_id").eq("attempt_id", attemptId);
  const original = listOf(after.data).find((r) => r.kind === "original" && r.question_id === questions[0].id);
  check("retry: a second reply adds nothing", f2.status === 200 && listOf(after.data).filter((r) => r.kind === "clarification").length === 1);
  check("preserved: the ORIGINAL answer text is unchanged and one clarification row was added", original?.typed_text === "No" && listOf(after.data).length === 4);
  const diags = await b.db.from("diagnoses").select("id").eq("student_id", bId);
  check("preserved: both diagnoses for the clarified question are kept", listOf(diags.data).length >= 4, `rows ${listOf(diags.data).length}`);
  const { data: p } = await b.db.from("concept_progress").select("state, teacher_cleared_to_next").eq("student_id", bId).eq("concept_id", "C3").maybeSingle();
  check("persisted: reloading shows 'passed' still awaiting the teacher", p?.state === "passed" && p.teacher_cleared_to_next === false);
}

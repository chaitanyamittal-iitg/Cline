// Saving one sitting (micro-test or reassessment) and answering a follow-up. The caller (the route) has already proved
// the user is a signed-in student; every read and write here is filtered by that user's own id, never by an id from
// the request body. Writes happen in ONE database function (migration 0007) so a sitting is saved whole or not at all.
// The AI is the mock unless AI_PROVIDER=live; nothing here makes a verdict itself: it only applies ./rules.ts.
import "server-only";
import {
  type Diagnosis,
  type FollowUpRequest,
  type SubmitAnswersRequest,
  type SubmitAnswersResponse,
} from "@/lib/contracts";
import { getAiProvider } from "@/lib/ai";
import type { AiProvider } from "@/lib/ai/types";
import { assessAttempt, FALLBACK_FOLLOW_UP, toSubmitResponse } from "./assess";
import { decideSave, judgedFrom, normaliseDiagnosis, storedVerdict } from "./decide";
import { callRpc, loadProgress, openDb, progressFromRpc, type Db } from "./db";
import { AI_UNAVAILABLE, fail, ok, SAVE_FAILED, type ServiceResult } from "./result";
import { IllegalTransitionError, type SittingKind } from "./rules";
import {
  loadApprovedResources,
  loadEarlierEvidence,
  loadKeys,
  loadOwnedAttempt,
  loadSaved,
  type OwnedAttempt,
} from "./sitting";

const EXPECTED_STATE: Record<SittingKind, string> = { microtest: "microtest", reassessment: "reassessment" };

export function diagnosisToRow(d: Diagnosis) {
  return {
    is_correct: d.isCorrect,
    reasoning_sound: d.reasoningSound,
    misconception: d.misconception,
    evidence: d.evidence,
    next_action: d.nextAction,
    follow_up_question: d.followUpQuestion,
    ai_source: d.source,
  };
}

/** The saved sitting, reported the way every route reports it. */
export async function reportSaved(
  db: Db,
  studentId: string,
  attempt: OwnedAttempt,
  progress: SubmitAnswersResponse["progress"],
): Promise<ServiceResult<SubmitAnswersResponse>> {
  const saved = await loadSaved(db, studentId, attempt.id);
  if (!saved.ok) return saved;
  const assessment = assessAttempt(attempt.questions.map((q) => q.id), saved.data.answers, saved.data.diagnoses);
  const response = toSubmitResponse(assessment, progress);
  if (!response) {
    console.error("[learning] reportSaved: the saved sitting could not be reported");
    return fail(500, "Your answers are saved, but we could not show the result. Please reload this page.");
  }
  return ok(response);
}

export function runAi<T>(label: string, work: () => Promise<T>): Promise<ServiceResult<T>> {
  return work().then(
    (value) => ok(value),
    (e: unknown) => {
      // A live provider that is not configured, or a failed call, must never turn into an invented verdict.
      console.error(`[learning] AI ${label} failed:`, e instanceof Error ? e.message : "unknown error");
      return fail(503, AI_UNAVAILABLE);
    },
  );
}

/**
 * Typed answers only in this stage: the text to diagnose for every question, or a 400. An uploaded image needs the
 * upload route (a later stage), so it is refused here rather than half-handled.
 */
export function checkAnswers(
  attempt: OwnedAttempt,
  req: SubmitAnswersRequest,
): ServiceResult<Map<string, string>> {
  const wanted = new Set(attempt.questions.map((q) => q.id));
  const texts = new Map<string, string>();
  for (const a of req.answers) {
    if (!wanted.has(a.questionId)) return fail(400, "One of the answers is for a question that is not in this test.");
    if (texts.has(a.questionId)) return fail(400, "Each question can only be answered once.");
    if (a.uploadPath !== undefined) {
      return fail(400, "Photo answers are not available yet. Please type your answer.");
    }
    texts.set(a.questionId, a.typedText!);
  }
  if (texts.size !== wanted.size) return fail(400, "Please answer every question before sending.");
  return ok(texts);
}

export async function submitAnswers(
  studentId: string,
  req: SubmitAnswersRequest,
  ai: AiProvider = getAiProvider(),
): Promise<ServiceResult<SubmitAnswersResponse>> {
  const opened = openDb();
  if (!opened.ok) return opened;
  const db = opened.data;

  const attemptRes = await loadOwnedAttempt(db, studentId, req.conceptId, req.attemptId);
  if (!attemptRes.ok) return attemptRes;
  const attempt = attemptRes.data;

  const progressRes = await loadProgress(db, studentId, req.conceptId);
  if (!progressRes.ok) return progressRes;
  const progress = progressRes.data.progress;

  // Safe retry: a sitting that is already saved is reported again and never judged or saved twice.
  const before = await loadSaved(db, studentId, attempt.id);
  if (!before.ok) return before;
  if (before.data.answers.some((a) => a.kind === "original")) return reportSaved(db, studentId, attempt, progress);

  if (progress.state !== EXPECTED_STATE[attempt.kind]) {
    return fail(409, "This test is not open for answers right now. Please reload the page.");
  }

  const checked = checkAnswers(attempt, req);
  if (!checked.ok) return checked;

  const keys = await loadKeys(db, attempt);
  if (!keys.ok) return keys;
  const resources = await loadApprovedResources(db, req.conceptId);
  if (!resources.ok) return resources;
  const earlierEvidence = await loadEarlierEvidence(db, studentId, req.conceptId);

  const items: Record<string, unknown>[] = [];
  const judged = [];
  for (const question of attempt.questions) {
    const text = checked.data.get(question.id)!;
    const key = keys.data.get(question.id)!;
    const diagnosed = await runAi("diagnose", () =>
      ai.diagnose({
        conceptId: req.conceptId,
        questionId: question.id,
        questionPrompt: question.prompt,
        expectedIdea: key.expectedIdea,
        knownMisconceptions: key.misconceptions,
        studentAnswer: text,
        earlierEvidence,
        approvedResources: resources.data,
      }),
    );
    if (!diagnosed.ok) return diagnosed;
    const diagnosis = normaliseDiagnosis(diagnosed.data, req.conceptId, question.id, FALLBACK_FOLLOW_UP);
    judged.push(judgedFrom(diagnosis, false));
    items.push({
      question_id: question.id,
      typed_text: text,
      is_correct: storedVerdict(diagnosis, false),
      diagnosis: diagnosisToRow(diagnosis),
    });
  }

  let decision;
  try {
    decision = decideSave(progress, attempt.kind, judged);
  } catch (e) {
    if (e instanceof IllegalTransitionError) return fail(409, "This test is not open for answers right now.");
    throw e;
  }

  const called = await callRpc(db, "safal_record_answers", {
    p_student: studentId,
    p_attempt: attempt.id,
    p_expected_state: progress.state,
    p_items: items,
    p_new_state: decision.newState,
    p_new_flagged: decision.newFlagged,
    p_cycle_outcome: decision.cycleOutcome,
  });
  if (!called.ok) return fail(500, SAVE_FAILED);

  const status = called.body.status;
  const newProgress = progressFromRpc(called.body.progress);
  if (status === "not_found") return fail(404, "We could not find that test.");
  if (status === "conflict") return fail(409, "Your progress changed while this was being saved. Please reload the page.");
  if ((status !== "ok" && status !== "already_submitted") || !newProgress) return fail(500, SAVE_FAILED);
  return reportSaved(db, studentId, attempt, newProgress);
}

/**
 * The student's reply to ONE open clarification. The SAME attempt resumes: the reply is saved as a second answer
 * linked to the original (which is never edited), the question is diagnosed again from both texts, and the sitting is
 * judged again. A clarification never uses a support cycle. A reply to a question that has no open follow-up is refused.
 */
export async function submitFollowUp(
  studentId: string,
  req: FollowUpRequest,
  ai: AiProvider = getAiProvider(),
): Promise<ServiceResult<SubmitAnswersResponse>> {
  const opened = openDb();
  if (!opened.ok) return opened;
  const db = opened.data;

  const attemptRes = await loadOwnedAttempt(db, studentId, req.conceptId, req.attemptId);
  if (!attemptRes.ok) return attemptRes;
  const attempt = attemptRes.data;
  const question = attempt.questions.find((q) => q.id === req.questionId);
  if (!question) return fail(400, "That question is not in this test.");

  const progressRes = await loadProgress(db, studentId, req.conceptId);
  if (!progressRes.ok) return progressRes;
  const progress = progressRes.data.progress;

  const savedRes = await loadSaved(db, studentId, attempt.id);
  if (!savedRes.ok) return savedRes;
  const original = savedRes.data.answers.find((a) => a.kind === "original" && a.question_id === req.questionId);
  if (!original) return fail(409, "That question has not been answered yet.");

  // Safe retry: a question that was already clarified is reported again, never clarified twice.
  if (savedRes.data.answers.some((a) => a.kind === "clarification" && a.clarifies_answer_id === original.id)) {
    return reportSaved(db, studentId, attempt, progress);
  }

  const before = assessAttempt(attempt.questions.map((q) => q.id), savedRes.data.answers, savedRes.data.diagnoses);
  if (!before.followUps.some((f) => f.questionId === req.questionId)) {
    return fail(409, "There is no open question to answer for this one.");
  }
  if (progress.state !== EXPECTED_STATE_FOR_FOLLOW_UP[attempt.kind]) {
    return fail(409, "This test is not open for a reply right now. Please reload the page.");
  }

  const keys = await loadKeys(db, attempt);
  if (!keys.ok) return keys;
  const key = keys.data.get(question.id)!;
  const resources = await loadApprovedResources(db, req.conceptId);
  if (!resources.ok) return resources;
  const earlierEvidence = await loadEarlierEvidence(db, studentId, req.conceptId);

  const diagnosed = await runAi("diagnose follow-up", () =>
    ai.diagnose({
      conceptId: req.conceptId,
      questionId: question.id,
      questionPrompt: question.prompt,
      expectedIdea: key.expectedIdea,
      knownMisconceptions: key.misconceptions,
      studentAnswer: original.typed_text ?? original.confirmed_text ?? "",
      clarification: req.response,
      earlierEvidence,
      approvedResources: resources.data,
    }),
  );
  if (!diagnosed.ok) return diagnosed;
  const diagnosis = normaliseDiagnosis(diagnosed.data, req.conceptId, question.id, FALLBACK_FOLLOW_UP);

  // Re-judge the whole sitting with this one question now clarified.
  const judged = before.judged.map((j) => (j.questionId === question.id ? judgedFrom(diagnosis, true) : j));
  let decision;
  try {
    decision = decideSave(progress, attempt.kind, judged);
  } catch (e) {
    if (e instanceof IllegalTransitionError) return fail(409, "This test is not open for a reply right now.");
    throw e;
  }

  const called = await callRpc(db, "safal_record_clarification", {
    p_student: studentId,
    p_attempt: attempt.id,
    p_question_id: question.id,
    p_response: req.response,
    p_expected_state: progress.state,
    p_diagnosis: diagnosisToRow(diagnosis),
    p_is_correct: storedVerdict(diagnosis, true),
    p_new_state: decision.newState,
    p_new_flagged: decision.newFlagged,
    p_cycle_outcome: decision.cycleOutcome,
  });
  if (!called.ok) return fail(500, SAVE_FAILED);

  const status = called.body.status;
  const newProgress = progressFromRpc(called.body.progress);
  if (status === "not_found") return fail(404, "We could not find that question.");
  if (status === "conflict") return fail(409, "Your progress changed while this was being saved. Please reload the page.");
  if ((status !== "ok" && status !== "already_clarified") || !newProgress) return fail(500, SAVE_FAILED);
  return reportSaved(db, studentId, attempt, newProgress);
}

/** A micro-test waits for its clarification in 'analysis'; a reassessment stays in 'reassessment'. */
const EXPECTED_STATE_FOR_FOLLOW_UP: Record<SittingKind, string> = { microtest: "analysis", reassessment: "reassessment" };

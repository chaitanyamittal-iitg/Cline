// Student steps before the written test: lesson -> doubts, and opening the predefined micro-test.
// The caller (the route) has already proved the user is a signed-in student; every query here is filtered by that id.
import "server-only";
import {
  StartMicrotestResponseSchema,
  type AdvanceProgressRequest,
  type AdvanceProgressResponse,
  type ConceptId,
  type StartMicrotestResponse,
} from "@/lib/contracts";
import { callRpc, loadProgress, openDb, progressFromRpc, toProgress, type ProgressRow } from "./db";
import { fail, ok, SAVE_FAILED, type ServiceResult } from "./result";
import { loadOwnedAttempt } from "./sitting";

/** lesson -> doubts. One conditional UPDATE, so two clicks cannot both "win". Repeating it once in 'doubts' is harmless. */
export async function advanceProgress(
  studentId: string,
  req: AdvanceProgressRequest,
): Promise<ServiceResult<AdvanceProgressResponse>> {
  const opened = openDb();
  if (!opened.ok) return opened;
  const db = opened.data;

  const { data, error } = await db
    .from("concept_progress")
    .update({ state: "doubts", updated_at: new Date().toISOString() })
    .eq("student_id", studentId)
    .eq("concept_id", req.conceptId)
    .eq("state", "lesson")
    .select("student_id, concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next");
  if (error) {
    console.error("[learning] advanceProgress:", error.message);
    return fail(500, SAVE_FAILED);
  }
  const moved = toProgress((data as ProgressRow[] | null)?.[0]);
  if (moved) return ok({ progress: moved });

  // Nothing moved: either there is no such row, or the student is not in 'lesson'.
  const current = await loadProgress(db, studentId, req.conceptId);
  if (!current.ok) return current;
  if (current.data.progress.state === "doubts") return ok({ progress: current.data.progress });
  return fail(409, "You are not at the lesson step for this concept, so there is nothing to move on from.");
}

/** doubts -> microtest. Idempotent: an unanswered test is returned again, never duplicated. Prompts only, no keys. */
export async function startMicrotest(
  studentId: string,
  conceptId: ConceptId,
): Promise<ServiceResult<StartMicrotestResponse>> {
  const opened = openDb();
  if (!opened.ok) return opened;
  const db = opened.data;

  const { data: rows, error } = await db
    .from("questions")
    .select("id, prompt")
    .eq("concept_id", conceptId)
    .order("position", { ascending: true });
  if (error) {
    console.error("[learning] startMicrotest questions:", error.message);
    return fail(500, SAVE_FAILED);
  }
  if (!rows || rows.length === 0) return fail(404, "This concept has no test questions yet. Please tell your teacher.");

  const called = await callRpc(db, "safal_start_microtest", {
    p_student: studentId,
    p_concept: conceptId,
    p_questions: rows.map((q) => ({ id: q.id, prompt: q.prompt })),
  });
  if (!called.ok) return fail(500, SAVE_FAILED);

  const { status, attempt_id: attemptId, progress: progressRow } = called.body;
  if (status === "not_found") return fail(404, "You have not started this concept yet.");
  if (status === "wrong_state") {
    return fail(409, "The written test is opened from the doubts step. Finish the lesson first, or reload this page.");
  }
  const progress = progressFromRpc(progressRow);
  if (status !== "ok" || typeof attemptId !== "string" || !progress) return fail(500, SAVE_FAILED);

  // Return the prompts that were SAVED with the attempt (an earlier open test keeps its own questions).
  const attempt = await loadOwnedAttempt(db, studentId, conceptId, attemptId);
  if (!attempt.ok) return attempt;
  const parsed = StartMicrotestResponseSchema.safeParse({
    attemptId,
    questions: attempt.data.questions.map((q) => ({ id: q.id, conceptId, prompt: q.prompt })),
    progress,
  });
  if (!parsed.success) {
    console.error("[learning] startMicrotest: response did not match the contract");
    return fail(500, SAVE_FAILED);
  }
  return ok(parsed.data);
}

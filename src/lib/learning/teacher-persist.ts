// Teacher-action persistence (Stage 1: approve_next_concept and note). Called ONLY by applyTeacherAction, after it has
// checked the session, so `teacherId` is always the signed-in teacher and never a value from the request body.
// All writes for an approval happen in one database function (migration 0007), so a crash cannot leave it half done.
import "server-only";
import {
  ConceptIdSchema,
  type ApproveNextPayload,
  type ConceptId,
  type TeacherActionInput,
  type TeacherActionResult,
} from "@/lib/contracts";
import { callRpc, loadProgress, openDb, progressFromRpc, toProgress, type Db, type ProgressRow } from "./db";
import { planApproval } from "./teacher-rules";

type Approve = Extract<TeacherActionInput, { action: "approve_next_concept" }>;
type Note = Extract<TeacherActionInput, { action: "note" }>;

const internal = (): TeacherActionResult => ({
  ok: false,
  code: "internal",
  error: "Saving failed and nothing was changed. Please try again.",
});
const notFound = (error: string): TeacherActionResult => ({ ok: false, code: "not_found", error });

async function loadCurriculum(db: Db): Promise<ConceptId[] | null> {
  const { data, error } = await db.from("concepts").select("id").order("position", { ascending: true });
  if (error || !data) {
    console.error("[teacher] curriculum:", error?.message ?? "no data");
    return null;
  }
  const ids: ConceptId[] = [];
  for (const row of data) {
    const parsed = ConceptIdSchema.safeParse(row.id);
    if (parsed.success) ids.push(parsed.data);
  }
  return ids;
}

async function loadNext(db: Db, studentId: string, conceptId: ConceptId | null) {
  if (!conceptId) return null;
  const { data, error } = await db
    .from("concept_progress")
    .select("student_id, concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next")
    .eq("student_id", studentId)
    .eq("concept_id", conceptId)
    .maybeSingle();
  if (error) {
    console.error("[teacher] loadNext:", error.message);
    return null;
  }
  return toProgress(data as ProgressRow | null);
}

export async function persistApproval(teacherId: string, input: Approve): Promise<TeacherActionResult> {
  const opened = openDb();
  if (!opened.ok) return { ok: false, code: "internal", error: opened.error };
  const db = opened.data;
  const curriculum = await loadCurriculum(db);
  if (!curriculum) return internal();

  // Two tries: if the row changes between planning and saving, plan again from the fresh row.
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await loadProgress(db, input.studentId, input.conceptId);
    if (!current.ok) {
      return current.status === 404 ? notFound("That student has no progress for this concept.") : internal();
    }
    const progress = current.data.progress;

    const nextId = curriculum[curriculum.indexOf(progress.conceptId) + 1] ?? null;
    const nextRow = await loadNext(db, input.studentId, nextId);
    const decision = planApproval({
      progress,
      curriculum,
      nextProgressExists: nextRow !== null,
      overrideUnderstanding: input.overrideUnderstanding,
      note: input.note,
    });
    if (!decision.ok) return { ok: false, code: "rule_violation", error: decision.reason };
    const plan = decision.plan;

    // A repeated approval: nothing to write, nothing to reset, no second audit row.
    if (plan.alreadyApplied) {
      return { ok: true, data: { progress, nextProgress: nextRow, alreadyApplied: true } };
    }

    const payload: ApproveNextPayload = {
      overrideUnderstanding: plan.overrideUnderstanding,
      stateAtApproval: plan.stateAtApproval,
      nextConceptId: plan.nextConceptId,
      createdNextProgress: plan.createNextProgress,
    };
    const called = await callRpc(db, "safal_teacher_approve", {
      p_teacher: teacherId,
      p_student: input.studentId,
      p_concept: input.conceptId,
      p_next_concept: plan.nextConceptId,
      p_expected_state: progress.state,
      p_expected_cleared: progress.teacherClearedToNext,
      p_set_cleared: plan.setCleared,
      p_create_next: plan.createNextProgress,
      p_note: input.note ?? null,
      p_payload: payload,
    });
    if (!called.ok) return internal();

    const status = called.body.status;
    if (status === "conflict") continue;
    if (status === "not_found") return notFound("That student has no progress for this concept.");
    const saved = progressFromRpc(called.body.progress);
    if (status !== "ok" || !saved) return internal();
    const nextProgress = plan.nextConceptId ? progressFromRpc(called.body.next_progress) : null;
    return { ok: true, data: { progress: saved, nextProgress, alreadyApplied: false } };
  }
  return { ok: false, code: "rule_violation", error: "The student's progress changed while this was being saved. Please look again and retry." };
}

/** Appends an audit note. It changes no learning state. */
export async function persistNote(teacherId: string, input: Note): Promise<TeacherActionResult> {
  const opened = openDb();
  if (!opened.ok) return { ok: false, code: "internal", error: opened.error };
  const db = opened.data;

  const current = await loadProgress(db, input.studentId, input.conceptId);
  if (!current.ok) {
    return current.status === 404 ? notFound("That student has no progress for this concept.") : internal();
  }
  const { error } = await db.from("teacher_actions").insert({
    teacher_id: teacherId,
    student_id: input.studentId,
    concept_id: input.conceptId,
    action: "note",
    note: input.note,
    payload: {},
  });
  if (error) {
    console.error("[teacher] note:", error.message);
    return internal();
  }
  return { ok: true, data: { progress: current.data.progress, nextProgress: null, alreadyApplied: false } };
}

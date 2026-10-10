// Stage 1 teacher checks. HONEST LIMIT: /api/teacher/action is owned by the Teacher worker and may not exist on this
// branch, so persistence is exercised by calling the real persistApproval / persistNote DIRECTLY with the real teacher
// id (from a real signed-in session). That proves the database behaviour, NOT the route's authentication. When the
// route exists, the last check below posts to it over HTTP; until then it prints [SKIP].
import { check, listOf, post, type Session } from "./http-lib";

const SHAPE = ["approve_next_concept", "note"] as const;

async function auditCount(teacher: Session, studentId: string): Promise<number> {
  const { data, error } = await teacher.db.from("teacher_actions").select("id, action").eq("student_id", studentId);
  if (error) throw new Error(`could not read teacher_actions as the teacher: ${error.message}`);
  return listOf(data).filter((r) => (SHAPE as readonly string[]).includes(String(r.action))).length;
}

export async function teacherChecks(teacher: Session, studentA: Session, studentB: Session) {
  const { persistApproval, persistNote } = await import("@/lib/learning/teacher-persist");
  const teacherId = (await teacher.db.auth.getUser()).data.user?.id;
  const aId = (await studentA.db.auth.getUser()).data.user?.id;
  const bId = (await studentB.db.auth.getUser()).data.user?.id;
  if (!teacherId || !aId || !bId) throw new Error("could not read the demo user ids");

  // Student A is still at the lesson step: approving without the override must be refused, and change nothing.
  const beforeA = await auditCount(teacher, aId);
  const refused = await persistApproval(teacherId, { studentId: aId, conceptId: "C3", action: "approve_next_concept" });
  check("teacher: approving a student who has not passed WITHOUT an override is refused", !refused.ok && refused.code === "rule_violation");
  check("teacher: the refusal wrote no audit row", (await auditCount(teacher, aId)) === beforeA);
  const aProgress = await studentA.db.from("concept_progress").select("concept_id, state, teacher_cleared_to_next").eq("student_id", aId);
  check("teacher: the refusal changed nothing for that student", listOf(aProgress.data).length === 1 && aProgress.data![0].teacher_cleared_to_next === false);

  // Student B has passed: a normal approval.
  const before = await auditCount(teacher, bId);
  const first = await persistApproval(teacherId, { studentId: bId, conceptId: "C3", action: "approve_next_concept" });
  check("teacher: approval of a passed student succeeds", first.ok, first.ok ? "" : first.error);
  if (first.ok) {
    check("teacher: current concept is cleared", first.data.progress.teacherClearedToNext === true && first.data.progress.conceptId === "C3");
    check("teacher: next concept (by curriculum order) is created in 'lesson'", first.data.nextProgress?.conceptId === "C4" && first.data.nextProgress.state === "lesson");
    check("teacher: first approval is not 'alreadyApplied'", first.data.alreadyApplied === false);
  }
  check("teacher: exactly one audit row was added", (await auditCount(teacher, bId)) === before + 1);

  const again = await persistApproval(teacherId, { studentId: bId, conceptId: "C3", action: "approve_next_concept" });
  check("teacher: a repeated approval reports alreadyApplied", again.ok && again.data.alreadyApplied === true);
  check("teacher: a repeated approval writes no second audit row", (await auditCount(teacher, bId)) === before + 1);
  const rows = await studentB.db.from("concept_progress").select("concept_id, state").eq("student_id", bId);
  check("teacher: no duplicate or reset progress rows (C3 and C4 once each)", listOf(rows.data).filter((r) => r.concept_id === "C4").length === 1 && listOf(rows.data).filter((r) => r.concept_id === "C3").length === 1);

  const noted = await persistNote(teacherId, { studentId: bId, conceptId: "C3", action: "note", note: "Integration check note." });
  check("teacher: a note is saved without changing learning state", noted.ok && noted.data.progress.state === "passed");
  check("teacher: the note added one audit row", (await auditCount(teacher, bId)) === before + 2);
  const log = await teacher.db.from("teacher_actions").select("teacher_id").eq("student_id", bId);
  check("teacher: every audit row names the SESSION teacher", listOf(log.data).length > 0 && listOf(log.data).every((r) => r.teacher_id === teacherId));

  // HTTP route, only if the Teacher worker's route exists on this checkout.
  const probe = await post("/api/teacher/action", { studentId: bId, conceptId: "C3", action: "note", note: "x" });
  if (probe.status === 404 && !probe.json) {
    console.log("[SKIP] teacher HTTP route: /api/teacher/action does not exist on this branch (owned by the Teacher worker).");
  } else {
    check("teacher route: unsigned request is a 401 JSON, not a redirect", probe.status === 401 && probe.json?.ok === false && probe.location === null, `status ${probe.status}`);
    const asStudent = await post("/api/teacher/action", { studentId: bId, conceptId: "C3", action: "note", note: "x" }, studentA);
    check("teacher route: a student is a 403 JSON", asStudent.status === 403 && asStudent.json?.ok === false, `status ${asStudent.status}`);
  }
}

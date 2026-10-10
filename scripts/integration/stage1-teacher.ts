// Stage 1 teacher checks. When /api/teacher/action exists they run THROUGH THE ROUTE over real HTTP with the real
// signed-in teacher; otherwise they say loudly that they fell back to direct persistence calls (see teacher-lib.ts).
// Nothing here resets data: if Student B was already approved by an earlier run, the first-approval checks print [SKIP]
// with the reason instead of passing.
import { check, isJson, listOf, post, type Session } from "./http-lib";
import { ROUTE, auditCount, makeActor, progressOf, routeExists, type Body } from "./teacher-lib";

export async function teacherChecks(teacher: Session, studentA: Session, studentB: Session) {
  const teacherId = (await teacher.db.auth.getUser()).data.user?.id;
  const aId = (await studentA.db.auth.getUser()).data.user?.id;
  const bId = (await studentB.db.auth.getUser()).data.user?.id;
  if (!teacherId || !aId || !bId) throw new Error("could not read the demo user ids");

  const viaHttp = await routeExists();
  if (viaHttp) console.log(`[INFO] teacher actions below go through ${ROUTE} over real HTTP as the signed-in teacher.`);
  else console.log(`[SKIP] ${ROUTE} does not exist on this branch (owned by the Teacher worker). Falling back to DIRECT persistence calls: this proves database behaviour only, NOT route authentication. Approval through the route is UNVERIFIED.`);
  const act = makeActor(teacherId, teacher, viaHttp);

  if (viaHttp) {
    const target = { studentId: bId, conceptId: "C3", action: "note", note: "x" };
    const noAuth = await post(ROUTE, target);
    check("teacher route: unsigned request is 401 JSON, not a redirect", noAuth.status === 401 && isJson(noAuth) && noAuth.location === null, `status ${noAuth.status}`);
    const asStudent = await post(ROUTE, target, studentA);
    check("teacher route: a student is 403 JSON", asStudent.status === 403 && isJson(asStudent) && asStudent.location === null, `status ${asStudent.status}`);
    const bad = await post(ROUTE, { studentId: bId, conceptId: "C3", action: "set_score" }, teacher);
    check("teacher route: an unknown action is 400 JSON", bad.status === 400 && isJson(bad), `status ${bad.status}`);
  }

  // Student A is at an early step: approving without the override must be refused and change nothing.
  const beforeA = await auditCount(teacher, aId);
  const refused = await act({ studentId: aId, conceptId: "C3", action: "approve_next_concept" });
  check("teacher: approving a student who has not passed WITHOUT an override is refused (409)", !refused.ok && (viaHttp ? refused.status === 409 : refused.error.startsWith("rule_violation")), `${refused.status ?? ""} ${refused.error}`);
  check("teacher: the refusal wrote no audit row", (await auditCount(teacher, aId)) === beforeA);
  const aRows = await studentA.db.from("concept_progress").select("teacher_cleared_to_next").eq("student_id", aId);
  check("teacher: the refusal changed nothing for that student", listOf(aRows.data).length >= 1 && listOf(aRows.data).every((r) => r.teacher_cleared_to_next === false));

  const clearedBefore = listOf((await studentB.db.from("concept_progress").select("teacher_cleared_to_next").eq("student_id", bId).eq("concept_id", "C3")).data)[0]?.teacher_cleared_to_next === true;
  let base = await auditCount(teacher, bId);
  const approve: Body = { studentId: bId, conceptId: "C3", action: "approve_next_concept" };
  if (clearedBefore) {
    console.log("[SKIP] teacher: FIRST-approval checks. Student B was already approved by an earlier run, and this script never resets data. Run npm run seed:users yourself, then re-run, to verify a first approval.");
  } else {
    const first = await act(approve);
    check("teacher: approval of a passed student succeeds", first.ok, first.error);
    check("teacher: current concept cleared", progressOf(first).teacherClearedToNext === true && progressOf(first).conceptId === "C3");
    const next = (first.data?.nextProgress ?? {}) as Record<string, unknown>;
    check("teacher: next concept (curriculum order) created in 'lesson'", next.conceptId === "C4" && next.state === "lesson");
    check("teacher: first approval is not 'alreadyApplied'", first.data?.alreadyApplied === false);
    check("teacher: exactly one audit row was added", (await auditCount(teacher, bId)) === base + 1);
    base += 1;
  }

  const again = await act(approve);
  check("teacher: a repeated approval succeeds and reports alreadyApplied", again.ok && again.data?.alreadyApplied === true, again.error);
  check("teacher: a repeated approval writes no second audit row", (await auditCount(teacher, bId)) === base);
  const rows = listOf((await studentB.db.from("concept_progress").select("concept_id").eq("student_id", bId)).data);
  check("teacher: no duplicate or reset progress rows (C3 and C4 once each)", rows.filter((r) => r.concept_id === "C3").length === 1 && rows.filter((r) => r.concept_id === "C4").length === 1);

  const noted = await act({ studentId: bId, conceptId: "C3", action: "note", note: "Integration check note." });
  check("teacher: a note is saved without changing learning state", noted.ok && progressOf(noted).state === "passed", noted.error);
  check("teacher: the note added exactly one audit row", (await auditCount(teacher, bId)) === base + 1);
  const log = listOf((await teacher.db.from("teacher_actions").select("teacher_id").eq("student_id", bId)).data);
  check("teacher: every audit row names the SESSION teacher", log.length > 0 && log.every((r) => r.teacher_id === teacherId));
}

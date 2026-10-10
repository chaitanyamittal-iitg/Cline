// Route checks for /api/teacher/action, over real HTTP with real sessions. Used by teacher-http-final.ts.
// Student B is the only target. No direct persistence calls. A FIRST approval is never exercised here.
import { check, isJson, listOf, post, type Session } from "./http-lib";

const ROUTE = "/api/teacher/action";

interface Who {
  teacher: Session;
  studentA: Session;
  studentB: Session;
  aId: string;
  bId: string;
}

export async function routeChecks({ teacher: t, studentA: a, studentB: b, aId, bId }: Who) {
  const note = { studentId: bId, conceptId: "C3", action: "note", note: "Final integration note (HTTP)." };

  // Authentication and input: always JSON, never a redirect.
  const anon = await post(ROUTE, note);
  check("teacher route: logged-out request is 401 JSON, no redirect", anon.status === 401 && isJson(anon) && anon.location === null, `status ${anon.status}`);
  const asStudent = await post(ROUTE, note, a);
  check("teacher route: a signed-in student is 403 JSON, no redirect", asStudent.status === 403 && isJson(asStudent) && asStudent.location === null, `status ${asStudent.status}`);
  const unknown = await post(ROUTE, { studentId: bId, conceptId: "C3", action: "set_score" }, t);
  check("teacher route: an unknown action is 400 JSON", unknown.status === 400 && isJson(unknown), `status ${unknown.status}`);
  const noNote = await post(ROUTE, { studentId: bId, conceptId: "C3", action: "approve_next_concept", overrideUnderstanding: true }, t);
  check("teacher route: an override with no note is 400 JSON", noNote.status === 400 && isJson(noNote), `status ${noNote.status}`);
  const badId = await post(ROUTE, { studentId: "not-a-uuid", conceptId: "C3", action: "note", note: "x" }, t);
  check("teacher route: a malformed student id is 400 JSON", badId.status === 400 && isJson(badId), `status ${badId.status}`);
  const ghost = await post(ROUTE, { ...note, studentId: "00000000-0000-4000-8000-000000000000" }, t);
  check("teacher route: a student with no progress is 404 JSON", ghost.status === 404 && isJson(ghost), `status ${ghost.status}`);
  const later = await post(ROUTE, { studentId: bId, conceptId: "C3", action: "clear_flag" }, t);
  check("teacher route: an action not built yet is 501 JSON, never a fake success", later.status === 501 && isJson(later) && later.json?.ok === false, `status ${later.status}`);

  // Repeat approval and a note for Student B, through the route as the real teacher.
  const bRow = listOf((await b.db.from("concept_progress").select("state, teacher_cleared_to_next").eq("student_id", bId).eq("concept_id", "C3")).data)[0];
  const audits = async () => listOf((await t.db.from("teacher_actions").select("action, teacher_id").eq("student_id", bId)).data);
  const before = await audits();
  if (bRow?.teacher_cleared_to_next !== true) {
    console.log("[SKIP] repeat approval: Student B is not already approved, so an approval here would be a FIRST approval. This script does not exercise a first approval (it would change demo state). First approval through HTTP remains UNVERIFIED.");
  } else {
    const again = await post(ROUTE, { studentId: bId, conceptId: "C3", action: "approve_next_concept" }, t);
    const d = again.json?.data as { alreadyApplied?: boolean; progress?: { teacherClearedToNext?: boolean }; nextProgress?: { conceptId?: string } | null } | undefined;
    check("teacher route: repeat approval is 200 and reports alreadyApplied", again.status === 200 && d?.alreadyApplied === true, `status ${again.status} ${again.json?.error ?? ""}`);
    check("teacher route: repeat approval still shows C3 cleared and C4 as next", d?.progress?.teacherClearedToNext === true && d?.nextProgress?.conceptId === "C4");
    check("teacher route: repeat approval wrote no audit row", (await audits()).length === before.length);
  }
  const added = await post(ROUTE, note, t);
  const nd = added.json?.data as { progress?: { state?: string } } | undefined;
  check("teacher route: a note is 200 and leaves the learning state unchanged", added.status === 200 && nd?.progress?.state === bRow?.state, `status ${added.status} ${added.json?.error ?? ""}`);
  const after = await audits();
  check("teacher route: the note added exactly one audit row", after.length === before.length + 1);
  check("teacher route: every audit row names the SESSION teacher, not a student", after.length > 0 && after.every((r) => typeof r.teacher_id === "string" && r.teacher_id !== aId && r.teacher_id !== bId));
}

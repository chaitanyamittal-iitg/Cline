// Final teacher checks over REAL HTTP through /api/teacher/action and the teacher detail page, with real signed-in demo
// sessions. No direct persistence calls, no fallback: if the route is missing this FAILS. Nothing is reset.
// TARGET is Student B only. Student A is used only as a signed-in session to prove a student gets 403, and a
// before/after snapshot proves Student A's records were not changed. Prints no password, key or token.
// Side effect: one audit note on Student B. A first approval is NOT exercised here (it would need a reset).
import { BASE_URL, check, isJson, listOf, post, signIn, summary, type Session } from "./http-lib";
import { routeChecks } from "./teacher-http-route";

const LEAKS = /expected_idea|expectedIdea|common_misconceptions|sb_secret_/;

async function snapshot(s: Session, id: string): Promise<string> {
  const progress = listOf((await s.db.from("concept_progress").select("concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next, updated_at").eq("student_id", id)).data);
  const attempts = listOf((await s.db.from("attempts").select("id").eq("student_id", id)).data);
  const answers = listOf((await s.db.from("answers").select("id").eq("student_id", id)).data);
  const actions = listOf((await s.db.from("teacher_actions").select("id").eq("student_id", id)).data);
  return [...progress, ...attempts, ...answers, ...actions].map((r) => JSON.stringify(r)).sort().join("\n");
}

async function getPage(path: string, s?: Session) {
  const res = await fetch(`${BASE_URL}${path}`, { redirect: "manual", headers: s ? { Cookie: s.cookie } : {} });
  return { status: res.status, location: res.headers.get("location"), text: await res.text() };
}

async function main() {
  const [a, b, t] = await Promise.all([
    signIn("student A", "student.a@safal.demo", "DEMO_STUDENT_A_PASSWORD"),
    signIn("student B", "student.b@safal.demo", "DEMO_STUDENT_B_PASSWORD"),
    signIn("teacher", "teacher@safal.demo", "DEMO_TEACHER_PASSWORD"),
  ]);
  const aId = (await a.db.auth.getUser()).data.user!.id;
  const bId = (await b.db.auth.getUser()).data.user!.id;
  const aBefore = await snapshot(a, aId);
  console.log(`[INFO] Student A snapshot taken (${aBefore.split("\n").length} record lines). It must be identical at the end.`);

  const exists = await post("/api/teacher/action", { studentId: bId, conceptId: "C3", action: "note", note: "probe" });
  if (exists.status === 404 && !isJson(exists)) {
    console.log("[FAIL] /api/teacher/action does not exist in this build. Teacher HTTP checks cannot run; nothing was substituted.");
    return;
  }
  await routeChecks({ teacher: t, studentA: a, studentB: b, aId, bId });

  // Teacher detail page.
  const page = await getPage(`/teacher/students/${bId}`, t);
  check("detail page: the teacher gets 200", page.status === 200, `status ${page.status}`);
  check("detail page: it shows Student B", /Student B/.test(page.text));
  check("detail page: it exposes no answer key or secret", !LEAKS.test(page.text));
  const anon = await getPage(`/teacher/students/${bId}`);
  check("detail page: logged-out is redirected to login", anon.status >= 300 && anon.status < 400 && /\/login/.test(anon.location ?? ""), `status ${anon.status} ${anon.location ?? ""}`);
  const stud = await getPage(`/teacher/students/${bId}`, a);
  check("detail page: a student is redirected away and sees no record", stud.status >= 300 && stud.status < 400 && !/Student B/.test(stud.text), `status ${stud.status}`);

  check("Student A's records are IDENTICAL to the start (clean lesson state preserved)", (await snapshot(a, aId)) === aBefore);
}

main()
  .then(() => {
    const { passes, failures } = summary();
    console.log(`\nTeacher HTTP: ${passes} passed, ${failures} failed.`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.log(`[FAIL] stopped early: ${e instanceof Error ? e.message : "unexpected error"}`);
    process.exit(1);
  });

// Stage 1 integration: the typed-answer journey over REAL HTTP routes with REAL signed-in demo sessions.
// Run (Windows, with the server up on BASE_URL, default http://localhost:3100):  npm run verify:stage1
// Student B walks the journey; Student A is used only to try (and fail) to touch B's work. Passwords and tokens are
// never printed. SIDE EFFECT: Student B ends at C3 'passed' with C3 approved and C4 created, plus audit rows.
// Nothing here resets anything. Run `npm run seed:users` yourself if you want a clean demo again.
import { createClient } from "@supabase/supabase-js";
import { check, isJson, post, signIn, summary, type Session } from "./http-lib";
import { answerChecks } from "./stage1-answers";
import { teacherChecks } from "./stage1-teacher";

const LEAKS = /expectedIdea|expected_idea|common_misconceptions/;

async function preflight(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.log("[FAIL] preflight: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY missing (this script runs on Windows only).");
    return false;
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const zero = "00000000-0000-0000-0000-000000000000";
  // Function EXECUTION check: a harmless call about a student that does not exist must answer 'not_found'.
  const { data, error } = await admin.rpc("safal_teacher_clear_flag", { p_teacher: zero, p_student: zero, p_concept: "C3", p_note: null, p_payload: {} });
  const ok = !error && (data as { status?: string } | null)?.status === "not_found";
  check("preflight: migration 0007 functions exist and run (safal_teacher_clear_flag answers 'not_found')", ok, error ? `${error.code ?? ""} ${error.message}` : "unexpected answer");
  return ok;
}

async function stateOf(s: Session, id: string) {
  const { data } = await s.db.from("concept_progress").select("state").eq("student_id", id).eq("concept_id", "C3").maybeSingle();
  return data?.state as string | undefined;
}

async function main() {
  const [a, b, t] = await Promise.all([
    signIn("student A", "student.a@safal.demo", "DEMO_STUDENT_A_PASSWORD"),
    signIn("student B", "student.b@safal.demo", "DEMO_STUDENT_B_PASSWORD"),
    signIn("teacher", "teacher@safal.demo", "DEMO_TEACHER_PASSWORD"),
  ]);
  const aId = (await a.db.auth.getUser()).data.user!.id;
  const bId = (await b.db.auth.getUser()).data.user!.id;
  const adv = { conceptId: "C3", to: "doubts" };

  // Authentication over real HTTP: JSON 401/403/400, never a redirect. These run BEFORE any database function is
  // needed and change nothing, so they are meaningful even while migration 0007 is not applied.
  for (const route of ["/api/progress/advance", "/api/attempts/start", "/api/answers", "/api/answers/follow-up"]) {
    const noAuth = await post(route, adv);
    check(`auth ${route}: unsigned request is 401 JSON, not a redirect to the login page`, noAuth.status === 401 && isJson(noAuth) && noAuth.json?.ok === false && noAuth.location === null, `status ${noAuth.status}`);
    const asTeacher = await post(route, adv, t);
    check(`auth ${route}: a teacher on a student route is 403 JSON`, asTeacher.status === 403 && isJson(asTeacher) && asTeacher.location === null, `status ${asTeacher.status}`);
  }
  const badBody = await post("/api/progress/advance", { conceptId: "C9", to: "doubts" }, b);
  check("input: a body that breaks the contract is 400 JSON", badBody.status === 400 && isJson(badBody), `status ${badBody.status}`);

  if (!(await preflight())) {
    console.log("[BLOCKED] The journey checks below need migration 0007. Apply supabase/migrations/0007_learning_loop_functions.sql, then re-run.");
    return;
  }
  const start = await stateOf(b, bId);
  if (start !== "lesson" && start !== "doubts") {
    console.log(`[STOP] Student B is at '${start ?? "no row"}', not 'lesson'. This check will not reset it. Run npm run seed:users first to repeat the journey.`);
    return;
  }

  const aBefore = await stateOf(a, aId);
  const smuggled = await post("/api/progress/advance", { ...adv, studentId: aId }, b);
  check("ownership: a student id in the body is ignored (B moves, A untouched)", smuggled.status === 200 && (await stateOf(a, aId)) === aBefore, `status ${smuggled.status}`);

  // lesson -> doubts (idempotent), then the predefined micro-test.
  const adv1 = await post("/api/progress/advance", adv, b);
  check("advance: student B is at 'doubts' (a repeat is harmless)", adv1.status === 200 && (adv1.json?.data?.progress as { state?: string })?.state === "doubts", `status ${adv1.status}`);
  const s1 = await post("/api/attempts/start", { conceptId: "C3" }, b);
  const s2 = await post("/api/attempts/start", { conceptId: "C3" }, b);
  const attemptId = s1.json?.data?.attemptId as string | undefined;
  const questions = (s1.json?.data?.questions ?? []) as { id: string }[];
  check("start: opens the predefined test with 3 written questions", s1.status === 200 && !!attemptId && questions.length === 3, `status ${s1.status} ${s1.json?.error ?? ""}`);
  check("start: a second call returns the SAME attempt (no duplicate)", s2.json?.data?.attemptId === attemptId);
  check("start: the response carries no answer key", !LEAKS.test(s1.raw));
  if (!attemptId) return;

  await answerChecks(a, b, bId, attemptId, questions);
  await teacherChecks(t, a, b);
}

main()
  .then(() => {
    const { passes, failures } = summary();
    console.log(`\nStage 1: ${passes} passed, ${failures} failed.`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.log(`[FAIL] stopped early: ${e instanceof Error ? e.message : "unexpected error"}`);
    process.exit(1);
  });

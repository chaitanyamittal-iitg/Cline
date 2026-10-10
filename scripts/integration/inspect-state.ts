// READ-ONLY look at the demo students' learning state, using each student's OWN session (row-level security applies).
// Writes nothing, resets nothing, prints no password, key or token. Run: npx tsx --env-file=.env.local scripts/integration/inspect-state.ts
import { listOf, signIn, type Session } from "./http-lib";

async function describe(who: string, s: Session) {
  const id = (await s.db.auth.getUser()).data.user?.id;
  if (!id) throw new Error(`${who}: no user id`);
  const progress = listOf((await s.db.from("concept_progress").select("concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next").eq("student_id", id).order("concept_id")).data);
  const attempts = listOf((await s.db.from("attempts").select("id, kind, cycle, concept_id").eq("student_id", id)).data);
  const answers = listOf((await s.db.from("answers").select("kind").eq("student_id", id)).data);
  const actions = listOf((await s.db.from("teacher_actions").select("action").eq("student_id", id)).data);
  console.log(`--- ${who}`);
  for (const p of progress) {
    console.log(`  ${p.concept_id}: state=${p.state} cycles_used=${p.support_cycles_used} flagged=${p.teacher_flagged} approved_to_next=${p.teacher_cleared_to_next}`);
  }
  const by = (rows: Record<string, unknown>[], key: string) => rows.reduce<Record<string, number>>((m, r) => ({ ...m, [String(r[key])]: (m[String(r[key])] ?? 0) + 1 }), {});
  console.log(`  attempts: ${attempts.length} ${JSON.stringify(by(attempts, "kind"))}`);
  console.log(`  answers: ${answers.length} ${JSON.stringify(by(answers, "kind"))}`);
  console.log(`  teacher_actions: ${actions.length} ${JSON.stringify(by(actions, "action"))}`);
}

async function main() {
  await describe("Student A", await signIn("student A", "student.a@safal.demo", "DEMO_STUDENT_A_PASSWORD"));
  await describe("Student B", await signIn("student B", "student.b@safal.demo", "DEMO_STUDENT_B_PASSWORD"));
}

main().catch((e) => {
  console.log(`[FAIL] ${e instanceof Error ? e.message : "unexpected error"}`);
  process.exit(1);
});

// Checks data isolation using the demo users' REAL signed-in sessions. Run: npm run verify:rls
// Publishable key only. Never resets or changes demo state: every write attempt targets an impossible id and
// is EXPECTED to be refused. Needs the demo accounts (npm run seed:users).
import { OWNED, check, notes, printReport, pub, signIn, url } from "./isolation/lib";
import { checkLoggedOut, checkTeacher } from "./isolation/anon-teacher";
import { checkStudent } from "./isolation/students";
import { checkGeneratedKeys } from "./isolation/generated-keys";

if (!url || !pub) {
  console.error("Missing Supabase settings in .env.local. Run: npm run env:check");
  process.exit(1);
}
if (pub.startsWith("sb_secret_")) {
  console.error("The public key slot holds a SECRET key. Fix .env.local first (npm run env:check).");
  process.exit(1);
}

async function main() {
  await checkLoggedOut();

  const a = await signIn("Student A", "student.a@safal.demo", "DEMO_STUDENT_A_PASSWORD");
  const b = await signIn("Student B", "student.b@safal.demo", "DEMO_STUDENT_B_PASSWORD");
  const t = await signIn("Teacher", "teacher@safal.demo", "DEMO_TEACHER_PASSWORD");
  if (!a || !b || !t) return;

  const rows = await checkTeacher(t, a, b);
  await checkStudent(a, b, t);
  await checkStudent(b, a, t);
  await checkGeneratedKeys(t, [a, b]);

  const withData = ["profiles", ...OWNED].filter((x) => (rows[x]?.length ?? 0) > 0);
  const empty = OWNED.filter((x) => (rows[x]?.length ?? 0) === 0);
  notes.push(`Row-level filtering is demonstrated with real data only for: ${withData.join(", ")}.`);
  if (empty.length) {
    notes.push(
      "These private tables hold no rows yet, so an empty result proves access works but NOT row filtering " +
        `(confirm their policies with supabase/verify_security_summary.sql): ${empty.join(", ")}.`,
    );
  }
  notes.push("Storage folders hold no files, so cross-user file reads are not demonstrated; only listing and upload refusal are.");
  notes.push("The teacher's successful INSERT into teacher_actions is not exercised (it would leave a permanent audit row).");
}

main()
  .catch((e) => check("script ran without crashing", false, e instanceof Error ? e.message : String(e)))
  .finally(printReport);

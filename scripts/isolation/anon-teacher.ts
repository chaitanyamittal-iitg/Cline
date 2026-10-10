// Logged-out and teacher checks for scripts/verify-isolation.ts. Publishable key + real sessions only.
import {
  ALL_OPS, ALL_TABLES, BUCKET, CONTENT, LEARNING, check, newClient, notRefused, read, type Row, type Session,
} from "./lib";

export async function checkLoggedOut() {
  const anon = newClient();
  const readProblems: string[] = [];
  for (const table of ALL_TABLES) {
    const r = await read(anon, table);
    if (r.error?.code !== "42501" || r.rows.length > 0) {
      readProblems.push(`${table}${r.error ? ` (code ${r.error.code ?? "?"})` : " (READABLE)"}`);
    }
  }
  check("logged-out: reads of all 14 tables are refused (permission denied)", readProblems.length === 0, readProblems.join(", "));
  const writeProblems = await notRefused(anon, ALL_TABLES, ALL_OPS);
  check("logged-out: writes to all 14 tables are refused", writeProblems.length === 0, writeProblems.join(", "));
  const list = await anon.storage.from(BUCKET).list("");
  check("logged-out: cannot list private uploads", Boolean(list.error) || (list.data?.length ?? 0) === 0);
}

/** Returns everything the teacher can read, so the caller can judge how strong the evidence is. */
export async function checkTeacher(t: Session, a: Session, b: Session): Promise<Record<string, Row[]>> {
  const rows: Record<string, Row[]> = {};
  const errors: string[] = [];
  for (const table of ALL_TABLES) {
    const r = await read(t.sb, table);
    rows[table] = r.rows;
    if (r.error) errors.push(`${table} (code ${r.error.code ?? "?"})`);
  }
  check("teacher: can read all 14 class/content tables", errors.length === 0, errors.join(", "));

  const progressIds = new Set(rows.concept_progress.map((r) => r.student_id));
  check(
    "teacher: sees the whole demo class (3 profiles, both students' progress, 9 answer keys)",
    rows.profiles.length === 3 && progressIds.has(a.id) && progressIds.has(b.id) && rows.question_keys.length === 9,
    `profiles=${rows.profiles.length}, progress rows=${rows.concept_progress.length}, keys=${rows.question_keys.length}`,
  );

  const bad = [
    ...(await notRefused(t.sb, [...LEARNING, ...CONTENT], ALL_OPS)),
    ...(await notRefused(t.sb, ["teacher_actions"], ["update", "delete"])),
  ];
  check("teacher: cannot edit learning state, content or the action log directly", bad.length === 0, bad.join(", "));

  const forged = await t.sb.from("teacher_actions").insert({
    teacher_id: a.id, student_id: a.id, concept_id: "C3", action: "note", note: "rls-verify",
  });
  check("teacher: cannot record an action under another person's name", forged.error?.code === "42501",
    forged.error ? `code ${forged.error.code ?? "?"}` : "ROW CREATED: a stray 'rls-verify' row now exists");
  check("teacher: can list a student's upload folder", !(await t.sb.storage.from(BUCKET).list(a.id)).error);
  void b;
  return rows;
}

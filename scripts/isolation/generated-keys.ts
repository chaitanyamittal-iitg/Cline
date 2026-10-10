// Isolation checks for the generated_question_keys table added by migration 0005.
// If 0005 has not been applied yet, this is SKIPPED with a note (it never counts as a pass).
import { ALL_OPS, check, newClient, notRefused, notes, read, type Session } from "./lib";

const TABLE = "generated_question_keys";
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]); // relation missing / not in the API schema cache

export async function checkGeneratedKeys(teacher: Session, students: Session[]) {
  const probe = await read(teacher.sb, TABLE);
  if (probe.error && MISSING_TABLE_CODES.has(probe.error.code ?? "")) {
    notes.push(`${TABLE} NOT CHECKED: the table does not exist yet, so migration 0005 has not been applied.`);
    return;
  }
  check(`teacher: can read ${TABLE} (hidden expected ideas for generated questions)`, !probe.error,
    probe.error ? `code ${probe.error.code ?? "?"}` : "");

  const anon = newClient();
  const anonRead = await read(anon, TABLE);
  check(`logged-out: cannot read ${TABLE}`, anonRead.error?.code === "42501" && anonRead.rows.length === 0,
    anonRead.error ? `code ${anonRead.error.code ?? "?"}` : "READABLE");
  const anonWrite = await notRefused(anon, [TABLE], ALL_OPS);
  check(`logged-out: cannot write ${TABLE}`, anonWrite.length === 0, anonWrite.join(", "));

  const teacherWrite = await notRefused(teacher.sb, [TABLE], ALL_OPS);
  check(`teacher: cannot write ${TABLE} directly (server-only)`, teacherWrite.length === 0, teacherWrite.join(", "));

  for (const s of students) {
    const r = await read(s.sb, TABLE);
    check(`${s.label}: sees no rows in ${TABLE}`, !r.error && r.rows.length === 0,
      r.error ? `code ${r.error.code ?? "?"}` : `rows=${r.rows.length}`);
    const bad = await notRefused(s.sb, [TABLE], ALL_OPS);
    check(`${s.label}: cannot write ${TABLE}`, bad.length === 0, bad.join(", "));
  }
  notes.push(`${TABLE}: the table is empty, so "students see no rows" shows access works, not row filtering; its policy text is checked by supabase/verify_security_summary.sql (row 14).`);
}

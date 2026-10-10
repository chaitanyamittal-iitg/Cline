// Student checks for scripts/verify-isolation.ts. Publishable key + each student's own session only.
import {
  ALL_OPS, BUCKET, CONTENT, LEARNING, OWNED, check, notRefused, read, type Session,
} from "./lib";

export async function checkStudent(s: Session, other: Session, teacher: Session) {
  const prof = await read(s.sb, "profiles");
  check(`${s.label}: sees only their own profile`,
    !prof.error && prof.rows.length === 1 && prof.rows[0].id === s.id, `rows=${prof.rows.length}`);

  const prog = await read(s.sb, "concept_progress");
  check(`${s.label}: can read their own learning progress`,
    !prog.error && prog.rows.length >= 1 && prog.rows.every((r) => r.student_id === s.id), `rows=${prog.rows.length}`);

  const errors: string[] = [];
  const leaks: string[] = [];
  for (const table of OWNED) {
    const r = await read(s.sb, table);
    if (r.error) errors.push(`${table} (code ${r.error.code ?? "?"})`);
    if (r.rows.some((row) => row.student_id !== s.id)) leaks.push(`LEAK in ${table}`);
  }
  check(`${s.label}: every private table returns only their own rows`,
    errors.length === 0 && leaks.length === 0, [...errors, ...leaks].join(", "));

  const crossTables: string[] = [];
  for (const table of OWNED) {
    const r = await read(s.sb, table, ["student_id", other.id]);
    if (r.error || r.rows.length > 0) crossTables.push(table);
  }
  const otherProfile = await read(s.sb, "profiles", ["id", other.id]);
  const teacherProfile = await read(s.sb, "profiles", ["id", teacher.id]);
  check(`${s.label}: cannot read ${other.label}'s records or the teacher's profile`,
    crossTables.length === 0 && !otherProfile.error && otherProfile.rows.length === 0 &&
      !teacherProfile.error && teacherProfile.rows.length === 0,
    crossTables.join(", "));

  const keys = await read(s.sb, "question_keys");
  check(`${s.label}: cannot read question answer keys`, !keys.error && keys.rows.length === 0, `rows=${keys.rows.length}`);
  const questions = await read(s.sb, "questions");
  check(`${s.label}: can read the 9 student-facing questions`,
    !questions.error && questions.rows.length === 9, `rows=${questions.rows.length}`);

  const bad = [
    ...(await notRefused(s.sb, [...LEARNING, ...CONTENT], ALL_OPS)),
    ...(await notRefused(s.sb, ["teacher_actions"], ["update", "delete"])),
  ];
  check(`${s.label}: cannot write learning state, content or the action log`, bad.length === 0, bad.join(", "));

  const forged = await s.sb.from("teacher_actions").insert({
    teacher_id: s.id, student_id: s.id, concept_id: "C3", action: "approve_next_concept", note: "rls-verify",
  });
  check(`${s.label}: cannot perform a teacher-only action`, forged.error?.code === "42501",
    forged.error ? `code ${forged.error.code ?? "?"}` : "ROW CREATED: a stray 'rls-verify' row now exists");

  check(`${s.label}: can list their own upload folder`, !(await s.sb.storage.from(BUCKET).list(s.id)).error);
  const theirs = await s.sb.storage.from(BUCKET).list(other.id);
  check(`${s.label}: cannot list ${other.label}'s upload folder`,
    Boolean(theirs.error) || (theirs.data?.length ?? 0) === 0);
  const upload = await s.sb.storage.from(BUCKET).upload(`${other.id}/rls-verify.txt`, new Blob(["x"]), { contentType: "text/plain" });
  check(`${s.label}: cannot upload into ${other.label}'s folder`, Boolean(upload.error),
    upload.error ? "" : "UPLOAD SUCCEEDED: a stray file now exists");
}

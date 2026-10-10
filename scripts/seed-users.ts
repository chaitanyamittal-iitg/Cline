// Creates (or resets) the FICTIONAL demo accounts. Run with: npm run seed:users
// Reads .env.local. Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and the DEMO_*_PASSWORD values.
// (The older name SUPABASE_SERVICE_ROLE_KEY is still accepted.)
// Safe to re-run: existing users are kept, profiles are upserted, and demo learning state is reset.
// Run the SQL migrations and seed/content_*.sql files in Supabase FIRST.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local. Run: npm run env:check");
  process.exit(1);
}

const demoUsers = [
  { email: "teacher@safal.demo", role: "teacher", name: "Ms. Rao (demo teacher)", pwEnv: "DEMO_TEACHER_PASSWORD" },
  { email: "student.a@safal.demo", role: "student", name: "Student A (demo)", pwEnv: "DEMO_STUDENT_A_PASSWORD" },
  { email: "student.b@safal.demo", role: "student", name: "Student B (demo)", pwEnv: "DEMO_STUDENT_B_PASSWORD" },
] as const;

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserId(email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id ?? null;
}

async function main() {
  const studentIds: string[] = [];

  for (const u of demoUsers) {
    const password = process.env[u.pwEnv];
    if (!password || password.length < 8) {
      throw new Error(`${u.pwEnv} must be set in .env.local (at least 8 characters).`);
    }
    let id = await findUserId(u.email);
    if (id) {
      const { error } = await supabase.auth.admin.updateUserById(id, { password });
      if (error) throw error;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({ email: u.email, password, email_confirm: true });
      if (error || !data.user) throw error ?? new Error("createUser returned no user");
      id = data.user.id;
    }
    const { error: pErr } = await supabase
      .from("profiles")
      .upsert({ id, role: u.role, display_name: u.name, class_label: "Class 7 (demo)" });
    if (pErr) throw pErr;
    if (u.role === "student") studentIds.push(id);
    console.log(`ok  ${u.role.padEnd(7)} ${u.email}`);
  }

  // Reset demo learning state so rehearsals can be rerun: both students start at C3 "lesson".
  for (const sid of studentIds) {
    for (const table of ["teacher_actions", "tutor_messages", "support_cycles", "homework", "attempts", "concept_progress"]) {
      const { error } = await supabase.from(table).delete().eq("student_id", sid);
      if (error) throw new Error(`reset ${table}: ${error.message}`);
    }
    const { error } = await supabase
      .from("concept_progress")
      .insert({ student_id: sid, concept_id: "C3", state: "lesson" });
    if (error) throw error;
  }
  console.log("Demo accounts ready. Demo learning state reset to C3 / lesson.");
}

main().catch((e) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

// Helpers for scripts/verify-isolation.ts. Uses ONLY the publishable key and the fictional users'
// own sessions. It never reads or prints SUPABASE_SECRET_KEY, passwords, keys or session tokens.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const ZERO = "00000000-0000-0000-0000-000000000000"; // impossible id: nothing real can match it
export const BUCKET = "student-work";
export const CONTENT = ["concepts", "questions", "resources", "question_keys", "profiles"];
export const OWNED = [
  "concept_progress", "attempts", "answers", "diagnoses", "support_cycles",
  "tutor_messages", "homework", "homework_responses", "teacher_actions",
];
export const LEARNING = OWNED.filter((t) => t !== "teacher_actions");
export const ALL_TABLES = [...CONTENT, ...OWNED];
export const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

export type Row = Record<string, unknown>;
export interface Session { label: string; sb: SupabaseClient; id: string }
export type Op = "insert" | "update" | "delete";
export const ALL_OPS: Op[] = ["insert", "update", "delete"];

export const results: { name: string; pass: boolean; detail: string }[] = [];
export const notes: string[] = [];
export const check = (name: string, pass: boolean, detail = "") => results.push({ name, pass, detail });

export function newClient(): SupabaseClient {
  return createClient(url!, pub!, clientOptions);
}

export async function signIn(label: string, email: string, pwEnv: string): Promise<Session | null> {
  const sb = newClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: process.env[pwEnv] ?? "" });
  if (error || !data.user) {
    check(`sign in as ${label}`, false, "sign-in failed: run npm run seed:users and check the DEMO_* password");
    return null;
  }
  check(`sign in as ${label}`, true);
  return { label, sb, id: data.user.id };
}

export async function read(sb: SupabaseClient, table: string, filter?: [string, string]) {
  let q = sb.from(table).select("*");
  if (filter) q = q.eq(filter[0], filter[1]);
  const { data, error } = await q;
  return { rows: (data ?? []) as Row[], error };
}

/** Tries one write aimed at the impossible id. Returns the error, or null if the database accepted it. */
async function attempt(sb: SupabaseClient, table: string, op: Op) {
  const pk = table === "question_keys" ? "question_id" : "id";
  const payload = { [pk]: ZERO } as never; // the client has no generated table types, so skip its row typing
  const from = sb.from(table);
  if (op === "insert") return (await from.insert(payload)).error;
  if (op === "update") return (await from.update(payload).eq(pk, ZERO)).error;
  return (await from.delete().eq(pk, ZERO)).error;
}

/** Writes that were NOT refused with "permission denied" (42501). An empty list means every write was blocked. */
export async function notRefused(sb: SupabaseClient, tables: string[], ops: Op[]): Promise<string[]> {
  const bad: string[] = [];
  for (const table of tables) {
    for (const op of ops) {
      const err = await attempt(sb, table, op);
      if (err?.code !== "42501") bad.push(`${op} ${table}${err ? ` (code ${err.code ?? "?"})` : " (ALLOWED)"}`);
    }
  }
  return bad;
}

export function printReport(): never {
  console.log("SAFAL data-isolation check (real signed-in sessions, publishable key only; no secrets printed)\n");
  for (const r of results) console.log(`${r.pass ? "[PASS]" : "[FAIL]"} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  const failed = results.filter((r) => !r.pass).length;
  console.log(failed === 0 ? `\nAll ${results.length} checks passed.` : `\n${failed} of ${results.length} checks FAILED.`);
  if (notes.length) console.log("\nLimits of this evidence:\n" + notes.map((n) => `  - ${n}`).join("\n"));
  process.exit(failed === 0 ? 0 : 1);
}

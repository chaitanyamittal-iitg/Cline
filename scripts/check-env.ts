// Checks .env.local WITHOUT ever printing a secret. Run: npm run env:check
// Prints only: set/missing, and whether the value LOOKS right (shape). Safe to screenshot.
// Add --live to also test the Supabase connection and that the migrations/seed content were applied.
import { createClient } from "@supabase/supabase-js";

type Level = "ok" | "missing" | "problem";
const results: { name: string; level: Level; note: string }[] = [];
const add = (name: string, level: Level, note: string) => results.push({ name, level, note });

const get = (n: string) => (process.env[n] ?? "").trim();

// ---- URL
const url = get("NEXT_PUBLIC_SUPABASE_URL");
if (!url) add("NEXT_PUBLIC_SUPABASE_URL", "missing", "empty. Copy the Project URL from Supabase (Connect > API).");
else if (/YOUR-PROJECT-REF/.test(url)) add("NEXT_PUBLIC_SUPABASE_URL", "problem", "still the placeholder from .env.example.");
else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))
  add("NEXT_PUBLIC_SUPABASE_URL", "problem", "should look like https://<project-ref>.supabase.co (no /rest/v1 or other path).");
else add("NEXT_PUBLIC_SUPABASE_URL", "ok", "set, looks like a Supabase project URL.");

// ---- Publishable key (browser-safe)
const pubName = get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const pub = get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!pub) add("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "missing", "empty. Copy the Publishable key (sb_publishable_...).");
else if (pub.startsWith("sb_secret_")) add(pubName, "problem", "this is a SECRET key in the PUBLIC slot. Replace it with the Publishable key and rotate that secret key in Supabase.");
else if (pub.startsWith("sb_publishable_")) add(pubName, "ok", "set, looks like a publishable key.");
else if (pub.startsWith("eyJ")) add(pubName, "ok", "set, looks like a legacy anon key (works, but prefer the publishable key).");
else add(pubName, "problem", "does not start with sb_publishable_. Check you copied the right key.");

// ---- Secret key (server only)
const secName = get("SUPABASE_SECRET_KEY") ? "SUPABASE_SECRET_KEY" : "SUPABASE_SERVICE_ROLE_KEY";
const sec = get("SUPABASE_SECRET_KEY") || get("SUPABASE_SERVICE_ROLE_KEY");
if (!sec) add("SUPABASE_SECRET_KEY", "missing", "empty. Copy a Secret key (sb_secret_...).");
else if (sec.startsWith("sb_publishable_")) add(secName, "problem", "this is a PUBLISHABLE key in the SECRET slot. Copy a Secret key instead.");
else if (sec.startsWith("sb_secret_")) add(secName, "ok", "set, looks like a secret key.");
else if (sec.startsWith("eyJ")) add(secName, "ok", "set, looks like a legacy service_role key (works, but prefer a secret key).");
else add(secName, "problem", "does not start with sb_secret_. Check you copied the right key.");
if (sec && pub && sec === pub) add("keys differ", "problem", "the secret and publishable values are identical. They must be different keys.");
if (Object.keys(process.env).some((k) => k.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE_ROLE/i.test(k)))
  add("NEXT_PUBLIC_ prefix", "problem", "a variable with SECRET/SERVICE_ROLE in its name starts with NEXT_PUBLIC_. That would expose it to browsers. Remove the prefix.");

// ---- Demo passwords (only length is checked)
for (const n of ["DEMO_TEACHER_PASSWORD", "DEMO_STUDENT_A_PASSWORD", "DEMO_STUDENT_B_PASSWORD"]) {
  const v = get(n);
  if (!v) add(n, "missing", "empty. Invent a password (8+ characters) for this fictional account.");
  else if (v.length < 8) add(n, "problem", "shorter than 8 characters.");
  else add(n, "ok", "set (length OK).");
}

// ---- AI mode
const ai = get("AI_PROVIDER") || "mock";
if (ai === "mock") add("AI_PROVIDER", "ok", "mock (outputs are labelled MOCK AI).");
else if (ai === "live") add("AI_PROVIDER", get("AI_API_KEY") ? "ok" : "problem", get("AI_API_KEY") ? "live, key present (provider not implemented yet)." : "live but AI_API_KEY is empty.");
else add("AI_PROVIDER", "problem", `unknown value "${ai}". Use mock or live.`);

async function liveChecks() {
  console.log("\nLive Supabase checks (reads only, prints counts, never prints keys):");
  const key = sec;
  if (!url || !key) return console.log("  skipped: URL or secret key missing.");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const counts: [string, number][] = [["concepts", 4], ["resources", 14], ["questions", 9], ["question_keys", 9]];
  for (const [table, expected] of counts) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
    if (error) console.log(`  [PROBLEM] ${table}: ${error.message}`);
    else console.log(`  [${count === expected ? "ok" : "CHECK"}] ${table}: ${count} rows (expected ${expected})`);
  }
  const { count: profiles, error: pErr } = await sb.from("profiles").select("*", { count: "exact", head: true });
  if (pErr) console.log(`  [PROBLEM] profiles: ${pErr.message}`);
  else console.log(`  [info] profiles: ${profiles} rows (3 after npm run seed:users)`);
}

const icon: Record<Level, string> = { ok: "[ok]     ", missing: "[MISSING]", problem: "[PROBLEM]" };
console.log("SAFAL .env.local check (values are never printed)\n");
for (const r of results) console.log(`${icon[r.level]} ${r.name}: ${r.note}`);
const bad = results.filter((r) => r.level !== "ok").length;

(async () => {
  if (process.argv.includes("--live") && bad === 0) await liveChecks();
  else if (process.argv.includes("--live")) console.log("\nFix the items above first, then re-run with --live.");
  console.log(bad === 0 ? "\nAll settings look good." : `\n${bad} item(s) need attention.`);
  process.exit(bad === 0 ? 0 : 1);
})();

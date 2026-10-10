// Helpers for the HTTP integration checks. Reads .env.local (via tsx --env-file). NEVER prints a password, a key or a
// session token: output is only PASS/FAIL lines and short status facts.
import { createServerClient } from "@supabase/ssr";

export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export interface Session {
  who: string;
  /** Cookie header for fetch(). Contains the login token: never print it. */
  cookie: string;
  /** Supabase client acting as this user (row-level security applies). */
  db: ReturnType<typeof createServerClient>;
}

export async function signIn(who: string, email: string, passwordEnv: string): Promise<Session> {
  const password = process.env[passwordEnv];
  if (!url || !publishable) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set.");
  if (!password) throw new Error(`${passwordEnv} is not set in .env.local.`);
  const jar = new Map<string, string>();
  const db = createServerClient(url, publishable, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (all) => all.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  // The Supabase host from this machine sometimes times out on a fresh connection ("fetch failed"). Retry ONLY that
  // network error: a wrong password or any real auth answer fails immediately and is never retried.
  let error: { message: string } | null = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    ({ error } = await db.auth.signInWithPassword({ email, password }));
    if (!error || !/fetch failed|timeout|network/i.test(error.message)) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (error) throw new Error(`${who}: sign-in failed (${error.message}).`);
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  return { who, cookie, db };
}

export interface Reply {
  status: number;
  location: string | null;
  contentType: string | null;
  json: { ok?: boolean; data?: Record<string, unknown>; error?: string } | null;
  raw: string;
}

export async function post(path: string, body: unknown, session?: Session): Promise<Reply> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    redirect: "manual", // a redirect to the login page must be SEEN, not followed
    headers: { "Content-Type": "application/json", ...(session ? { Cookie: session.cookie } : {}) },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json: Reply["json"] = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
  return { status: res.status, location: res.headers.get("location"), contentType: res.headers.get("content-type"), json, raw };
}

let failures = 0;
let passes = 0;
export function check(name: string, ok: boolean, detail = ""): boolean {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${name}${!ok && detail ? `  -> ${detail}` : ""}`);
  return ok;
}
export const summary = () => ({ passes, failures });

/** Rows from a Supabase read, typed loosely so the checks can compare fields without implicit any. */
export const listOf = (data: unknown): Record<string, unknown>[] => (Array.isArray(data) ? (data as Record<string, unknown>[]) : []);

export const isJson = (r: Reply) => /application\/json/.test(r.contentType ?? "") && r.json !== null;

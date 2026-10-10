// Guard test for the ownership rules in docs/TASKS.md. It reads source text only.
//  - Only the persistence layers may use the secret-key (admin) Supabase client.
//  - Browser ("use client") files must never import server-only modules.
//  - No NEXT_PUBLIC_ variable may carry a secret.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "src");
const files = (readdirSync(root, { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .map((f) => ({ rel: f.split(path.sep).join("/"), text: readFileSync(path.join(root, f), "utf8") }))
  .filter((f) => !/\.test\.tsx?$/.test(f.rel));

const ADMIN_ALLOWED = ["lib/supabase/", "lib/learning/", "lib/homework/"];

describe("ownership and secret-handling rules", () => {
  it("scans real source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("uses the admin (secret key) client only in the persistence layers", () => {
    const offenders = files
      .filter((f) => f.text.includes("createSupabaseAdminClient"))
      .filter((f) => !ADMIN_ALLOWED.some((p) => f.rel.startsWith(p)))
      .map((f) => f.rel);
    expect(offenders, "move this call into src/lib/learning or src/lib/homework").toEqual([]);
  });

  it("reads the secret key only inside env.ts and the supabase folder", () => {
    const offenders = files
      .filter((f) => f.text.includes("supabaseSecretKey") || f.text.includes("SUPABASE_SECRET_KEY"))
      .filter((f) => f.rel !== "lib/env.ts" && !f.rel.startsWith("lib/supabase/"))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("keeps server-only modules out of client components", () => {
    const offenders = files
      .filter((f) => /^\s*["']use client["']/.test(f.text))
      .filter((f) => /from\s+["']@\/lib\/(supabase\/server|ai|auth|env|learning|homework)/.test(f.text))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("never puts a secret in a NEXT_PUBLIC_ variable", () => {
    const offenders = files.filter((f) => /NEXT_PUBLIC_\w*(SECRET|SERVICE_ROLE)/.test(f.text)).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});

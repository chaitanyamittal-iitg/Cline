// Guard test: reads the SQL migrations and checks the security rules the team agreed on.
// Project setting: Data API ON, automatic table exposure OFF, automatic RLS ON, so every table needs
// an explicit GRANT plus RLS. This test cannot prove the database behaves correctly (run
// supabase/verify_security.sql for that); it stops obvious mistakes before they are merged.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.resolve(process.cwd(), "supabase", "migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(dir, f), "utf8"))
  .join("\n")
  .replace(/--.*$/gm, ""); // drop comments so words inside them are ignored

const tables = [...sql.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1]);

interface Grant {
  privileges: string[];
  tables: string[];
  roles: string[];
}

const grants: Grant[] = [...sql.matchAll(/\bgrant\s+([\s\S]*?)\s+on\s+([\s\S]*?)\s+to\s+([^;]+);/gi)]
  .filter((m) => !/^(schema|function)\b/i.test(m[2].trim())) // table grants only
  .map((m) => ({
    privileges: m[1].split(",").map((p) => p.trim().toLowerCase()),
    tables: [...m[2].matchAll(/public\.(\w+)/g)].map((t) => t[1]),
    roles: m[3].split(",").map((r) => r.trim().toLowerCase()),
  }));

describe("database migrations", () => {
  it("finds the expected tables (14 from migrations 0001-0004, plus generated_question_keys from 0005)", () => {
    expect(tables.length).toBe(15);
    expect(tables).toContain("generated_question_keys");
  });

  it("migration 0006 only alters answers: no new table and no new grant to any API role", () => {
    const text = readFileSync(path.join(dir, "0006_clarification_and_handwriting.sql"), "utf8").replace(/--.*$/gm, "");
    expect(text).not.toMatch(/create\s+table/i);
    expect(text).not.toMatch(/\bgrant\b/i);
    expect(text).not.toMatch(/\bdrop\b/i);
    expect(text).not.toMatch(/(?:update|delete\s+from|truncate)\s+public\./i);
    expect(text.match(/alter table public\.(\w+)/gi)?.every((s) => /public\.answers$/i.test(s))).toBe(true);
  });

  it("keeps generated answer keys teacher-only, like question_keys", () => {
    expect(sql).toMatch(/create policy "generated_question_keys: teacher only"[\s\S]*?is_teacher\(\)/i);
    expect(sql).not.toMatch(/grant[^;]*insert[^;]*generated_question_keys[^;]*to[^;]*authenticated/i);
  });

  it.each(tables)("%s has row-level security enabled", (t) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`, "i"));
  });

  it.each(tables)("%s has an explicit grant for the server role", (t) => {
    const ok = grants.some((g) => g.roles.includes("service_role") && g.tables.includes(t));
    expect(ok, `no GRANT ... TO service_role for public.${t}`).toBe(true);
  });

  it.each(tables)("%s is readable by logged-in users (RLS limits the rows)", (t) => {
    const ok = grants.some(
      (g) => g.roles.includes("authenticated") && g.privileges.includes("select") && g.tables.includes(t),
    );
    expect(ok, `no GRANT SELECT ... TO authenticated for public.${t}`).toBe(true);
  });

  it("never grants anything on tables to anon (logged-out visitors)", () => {
    expect(grants.filter((g) => g.roles.includes("anon"))).toEqual([]);
  });

  it("gives logged-in users read access, plus insert only on teacher_actions", () => {
    for (const g of grants.filter((x) => x.roles.includes("authenticated"))) {
      for (const p of g.privileges) {
        expect(["select", "insert"]).toContain(p);
        if (p === "insert") expect(g.tables).toEqual(["teacher_actions"]);
      }
    }
  });

  it("never grants public tables to PUBLIC", () => {
    expect(grants.filter((g) => g.roles.includes("public"))).toEqual([]);
  });
});

// Source-text guards for the API routes (they cannot run here without a server; scripts/integration/stage1-http.ts
// exercises them for real). They stop the two mistakes that would break the contract silently.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = path.resolve(process.cwd(), "src", "app", "api");
const routes = (readdirSync(apiRoot, { recursive: true }) as string[])
  .filter((f) => /route\.ts$/.test(f))
  .map((f) => ({ rel: f.split(path.sep).join("/"), text: readFileSync(path.join(apiRoot, f), "utf8") }));

const stage1 = ["progress/advance/route.ts", "attempts/start/route.ts", "answers/route.ts", "answers/follow-up/route.ts"];
const learningDir = path.resolve(process.cwd(), "src", "lib", "learning");
const learningSources = readdirSync(learningDir)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => ({ rel: f, text: readFileSync(path.join(learningDir, f), "utf8") }));

describe("Stage 1 API routes", () => {
  it("finds every Stage 1 route", () => {
    for (const r of stage1) expect(routes.map((x) => x.rel)).toContain(r);
  });

  it.each(stage1)("%s authenticates as a STUDENT with the API-safe helper and never redirects", (rel) => {
    const text = routes.find((r) => r.rel === rel)!.text;
    expect(text).toMatch(/authenticateApi\("student"\)/);
    expect(text).not.toMatch(/requireStudent|requireTeacher|redirect\(/);
  });

  it.each(stage1)("%s takes the student id from the session, never from the request body", (rel) => {
    const text = routes.find((r) => r.rel === rel)!.text;
    expect(text).toMatch(/auth\.user\.id/);
    expect(text).not.toMatch(/studentId|student_id/);
  });

  it("no route under src/app/api uses a redirecting guard (teacher route included, when it exists)", () => {
    for (const r of routes) expect(r.text, r.rel).not.toMatch(/\brequireStudent\(|\brequireTeacher\(|\bredirect\(/);
  });
});

describe("learning services keep answer keys server-side", () => {
  it("only the key loaders read the key tables", () => {
    const readers = learningSources.filter((s) => /question_keys|generated_question_keys/.test(s.text)).map((s) => s.rel);
    expect(readers).toEqual(["sitting.ts"]);
  });

  it("no service puts an expected idea into a value it returns to the student", () => {
    for (const s of learningSources.filter((x) => ["answers-service.ts", "progress-service.ts", "assess.ts"].includes(x.rel))) {
      const lines = s.text.split("\n").filter((l) => /expectedIdea|expected_idea/.test(l));
      // The only allowed use is handing the hidden idea to the AI provider (first answer and follow-up).
      for (const line of lines) {
        expect(line.trim(), `${s.rel}: ${line.trim()}`).toBe("expectedIdea: key.expectedIdea,");
      }
      expect(lines.length, s.rel).toBeLessThanOrEqual(s.rel === "answers-service.ts" ? 2 : 0);
    }
  });

  it("every database read or write in a student service is filtered by the caller's id", () => {
    const text = learningSources.find((s) => s.rel === "sitting.ts")!.text;
    for (const table of ["attempts", "answers", "diagnoses"]) {
      const block = text.slice(text.indexOf(`.from("${table}")`));
      expect(block.slice(0, 400), table).toMatch(/\.eq\("student_id", studentId\)/);
    }
  });
});

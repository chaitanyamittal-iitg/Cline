import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { doubtPrompt, SKIP_DOUBTS_LABEL } from "./doubt-text";

describe("doubt wording", () => {
  it("uses the exact supplied wording for Complete circuits", () => {
    expect(doubtPrompt("Complete circuits")).toBe(
      "What is still unclear about complete circuits? You can ask about the battery, wires, bulb or switch.",
    );
  });

  it("keeps the skip option label exactly as supplied", () => {
    expect(SKIP_DOUBTS_LABEL).toBe("I have no doubts \u2014 start the micro-test");
  });

  it("falls back to plain words for a blank title", () => {
    expect(doubtPrompt("  ")).toMatch(/^What is still unclear about this concept\?/);
  });
});

// The live assessment must render the prompts returned by /api/attempts/start, so that submitted answers match the
// backend's keys. This guard fails if question text from the supplied micro-test is pasted into student code.
describe("no hardcoded assessment questions in student code", () => {
  const roots = ["src/lib/student", "src/components/student", "src/app/student"].map((r) => path.resolve(process.cwd(), r));
  const files: { rel: string; text: string }[] = [];
  for (const root of roots) {
    for (const f of readdirSync(root, { recursive: true }) as string[]) {
      if (!/\.(ts|tsx)$/.test(f) || /\.test\.tsx?$/.test(f)) continue;
      files.push({ rel: `${path.basename(root)}/${f}`, text: readFileSync(path.join(root, f), "utf8") });
    }
  }
  const fragments = [
    "Draw a simple circuit in which a cell lights a bulb",
    "second wire only holds the bulb in place",
    "Describe two checks you would make",
    "does not prove that the circuit is complete",
    "A student opens a switch in a working circuit",
  ];

  it("scans real source files", () => expect(files.length).toBeGreaterThan(10));

  it.each(fragments)("does not contain: %s", (fragment) => {
    const offenders = files.filter((f) => f.text.includes(fragment)).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});

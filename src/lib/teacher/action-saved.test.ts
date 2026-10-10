import { describe, expect, it } from "vitest";
import { describeSaved } from "./action-response";

const progress = {
  studentId: "123e4567-e89b-42d3-a456-426614174000",
  conceptId: "C3" as const,
  state: "passed" as const,
  supportCyclesUsed: 0,
  teacherFlagged: false,
  teacherClearedToNext: true,
};
const next = { ...progress, conceptId: "C4" as const, state: "lesson" as const, teacherClearedToNext: false };

describe("describeSaved", () => {
  it("reports the real next concept after an approval", () => {
    const out = describeSaved("approve_next_concept", { progress, nextProgress: next, alreadyApplied: false });
    expect(out.details.join(" ")).toMatch(/C4/);
  });

  it("says there is no next concept when nextProgress is null on an approval", () => {
    const out = describeSaved("approve_next_concept", { progress, nextProgress: null, alreadyApplied: false });
    expect(out.details.join(" ")).toMatch(/last concept/);
  });

  it("reports alreadyApplied accurately and adds no next-concept claim for other actions", () => {
    const out = describeSaved("clear_flag", { progress, nextProgress: null, alreadyApplied: true });
    expect(out.details.join(" ")).toMatch(/already been applied/);
    expect(out.details.join(" ")).not.toMatch(/last concept|next concept/);
  });

  it("adds no extra claims for an ordinary first-time save", () => {
    expect(describeSaved("note", { progress, nextProgress: null, alreadyApplied: false }).details).toEqual([]);
  });
});

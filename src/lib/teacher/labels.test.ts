import { describe, expect, it } from "vitest";
import { LearningStateSchema } from "@/lib/contracts";
import {
  aiSourceInfo,
  approvalLabel,
  attemptKindLabel,
  attentionLabel,
  correctnessLabel,
  formatTimestamp,
  outcomeLabel,
  stateLabel,
} from "./labels";
import { isPathInStudentFolder, SIGNED_URL_SECONDS, STUDENT_WORK_BUCKET } from "./images";
import { isStudentIdFormat } from "./ids";

describe("labels", () => {
  it("has a readable label for every stored learning state", () => {
    for (const state of LearningStateSchema.options) {
      expect(stateLabel(state)).not.toMatch(/Unrecognised/);
    }
  });

  it("never invents a label for an unknown state", () => {
    expect(stateLabel("mystery")).toBe("Unrecognised state (mystery)");
  });

  it("keeps the attention flag and the approval record as separate plain statements", () => {
    expect(attentionLabel(true)).toBe("Teacher attention needed");
    expect(attentionLabel(false)).toBe("No attention flag");
    expect(approvalLabel(true)).toBe("Teacher has approved moving on");
    expect(approvalLabel(false)).toBe("No approval recorded");
  });

  it("distinguishes micro-tests from reassessments", () => {
    expect(attemptKindLabel("microtest", 0)).toBe("Initial written micro-test");
    expect(attemptKindLabel("reassessment", 2)).toBe("Reassessment (support cycle 2)");
  });

  it("labels outcomes and correctness without any number", () => {
    expect(outcomeLabel("struggled")).toBe("Struggled");
    expect(correctnessLabel(null)).toBe("Not yet assessed");
    expect(correctnessLabel(true)).toBe("Recorded as correct");
    expect(correctnessLabel(false)).toBe("Recorded as incorrect");
  });

  it("calls only an exact 'live' source live, and labels mock clearly", () => {
    expect(aiSourceInfo("mock")).toEqual({ label: "MOCK AI", tone: "mock" });
    expect(aiSourceInfo("live")).toEqual({ label: "Live AI", tone: "live" });
    expect(aiSourceInfo(null).tone).toBe("unknown");
    expect(aiSourceInfo(undefined).tone).toBe("unknown");
    expect(aiSourceInfo("LIVE").tone).toBe("unknown");
    expect(aiSourceInfo("anything else").label).not.toMatch(/live/i);
  });

  it("formats timestamps deterministically in UTC and tolerates bad input", () => {
    expect(formatTimestamp("2026-10-10T08:30:45.000Z")).toBe("2026-10-10 08:30 UTC");
    expect(formatTimestamp("not a date")).toBe("not a date");
  });
});

describe("private image path rules", () => {
  const student = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";

  it("uses the existing private bucket and a short expiry", () => {
    expect(STUDENT_WORK_BUCKET).toBe("student-work");
    expect(SIGNED_URL_SECONDS).toBeLessThanOrEqual(300);
  });

  it("accepts only files directly inside the selected student's own folder", () => {
    expect(isPathInStudentFolder(`${student}/a-b-1.jpg`, student)).toBe(true);
    expect(isPathInStudentFolder(`${other}/a-b-1.jpg`, student)).toBe(false);
    expect(isPathInStudentFolder(`${student}`, student)).toBe(false);
    expect(isPathInStudentFolder(`${student}/`, student)).toBe(false);
    expect(isPathInStudentFolder(`${student}/../${other}/x.jpg`, student)).toBe(false);
    expect(isPathInStudentFolder(`${student}//x.jpg`, student)).toBe(false);
    expect(isPathInStudentFolder(`${student}\\x.jpg`, student)).toBe(false);
    expect(isPathInStudentFolder(`/${student}/x.jpg`, student)).toBe(false);
    expect(isPathInStudentFolder("x.jpg", student)).toBe(false);
  });
});

describe("route id validation", () => {
  it("accepts a uuid and rejects everything else before any query", () => {
    expect(isStudentIdFormat("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isStudentIdFormat("../etc/passwd")).toBe(false);
    expect(isStudentIdFormat("student-a")).toBe(false);
    expect(isStudentIdFormat("")).toBe(false);
    expect(isStudentIdFormat("11111111-1111-4111-8111-111111111111 ")).toBe(false);
  });
});

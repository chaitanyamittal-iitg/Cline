import { beforeEach, describe, expect, it, vi } from "vitest";

// teacher-actions.ts is server-only and reads the login cookie; replace both so the real checks run in plain Node.
vi.mock("server-only", () => ({}));
const getCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));

import { TEACHER_ACTIONS_PERSISTENCE_READY, applyTeacherAction } from "./teacher-actions";

const teacherId = "223e4567-e89b-42d3-a456-426614174001";
const studentId = "123e4567-e89b-42d3-a456-426614174000";
const teacher = { id: teacherId, role: "teacher" as const, displayName: "Ms. Rao" };
const note = { studentId, conceptId: "C3", action: "note", note: "Spoke to the student." };

beforeEach(() => getCurrentUser.mockReset());

describe("applyTeacherAction", () => {
  it("does not claim persistence is ready", () => {
    expect(TEACHER_ACTIONS_PERSISTENCE_READY).toBe(false);
  });

  it("refuses a student, and does not even read the session", async () => {
    const r = await applyTeacherAction({ id: studentId, role: "student" }, note);
    expect(r).toMatchObject({ ok: false, code: "forbidden" });
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("refuses a caller who says they are a teacher but has no session", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await applyTeacherAction({ id: teacherId, role: "teacher" }, note)).toMatchObject({ code: "forbidden" });
  });

  it("refuses a made-up teacher identity that does not match the session", async () => {
    getCurrentUser.mockResolvedValue({ id: studentId, role: "student", displayName: "Student A" });
    expect(await applyTeacherAction({ id: teacherId, role: "teacher" }, note)).toMatchObject({ code: "forbidden" });
    getCurrentUser.mockResolvedValue({ ...teacher, id: "323e4567-e89b-42d3-a456-426614174002" });
    expect(await applyTeacherAction(teacher, note)).toMatchObject({ code: "forbidden" });
  });

  it("checks authorization before it validates input", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await applyTeacherAction(teacher, { nonsense: true })).toMatchObject({ code: "forbidden" });
  });

  it("rejects invalid input from a real teacher", async () => {
    getCurrentUser.mockResolvedValue(teacher);
    expect(await applyTeacherAction(teacher, { studentId, conceptId: "C3", action: "set_score" })).toMatchObject({ ok: false, code: "invalid_input" });
    expect(await applyTeacherAction(teacher, { ...note, note: "" })).toMatchObject({ code: "invalid_input" });
  });

  it("never fakes success: a valid action returns not_implemented", async () => {
    getCurrentUser.mockResolvedValue(teacher);
    const r = await applyTeacherAction(teacher, note);
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ ok: false, code: "not_implemented" });
    expect(r.ok === false && r.error).toMatch(/not built yet/i);
  });

  it("ignores any actor identity smuggled into the body", async () => {
    getCurrentUser.mockResolvedValue(teacher);
    const r = await applyTeacherAction(teacher, { ...note, teacherId: studentId, teacher_id: studentId });
    expect(r).toMatchObject({ code: "not_implemented" });
  });
});

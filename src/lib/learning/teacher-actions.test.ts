import { beforeEach, describe, expect, it, vi } from "vitest";

// teacher-actions.ts is server-only and reads the login cookie; replace both so the real checks run in plain Node.
vi.mock("server-only", () => ({}));
const getCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));

// Persistence is replaced here so these tests stay about WHO may act and WHAT is accepted. The real writes are
// exercised against the live database by scripts/integration/stage1-http.ts.
const persistApproval = vi.fn();
const persistNote = vi.fn();
vi.mock("./teacher-persist", () => ({
  persistApproval: (...a: unknown[]) => persistApproval(...a),
  persistNote: (...a: unknown[]) => persistNote(...a),
}));

import { PERSISTED_TEACHER_ACTIONS, TEACHER_ACTIONS_PERSISTENCE_READY, applyTeacherAction } from "./teacher-actions";

const teacherId = "223e4567-e89b-42d3-a456-426614174001";
const studentId = "123e4567-e89b-42d3-a456-426614174000";
const teacher = { id: teacherId, role: "teacher" as const, displayName: "Ms. Rao" };
const note = { studentId, conceptId: "C3", action: "note", note: "Spoke to the student." };
const clearFlag = { studentId, conceptId: "C3", action: "clear_flag" };

beforeEach(() => {
  getCurrentUser.mockReset();
  persistApproval.mockReset();
  persistNote.mockReset();
});

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

  it("never fakes success: an action that is not built yet returns not_implemented and writes nothing", async () => {
    getCurrentUser.mockResolvedValue(teacher);
    for (const body of [clearFlag]) {
      const r = await applyTeacherAction(teacher, body);
      expect(r).toMatchObject({ ok: false, code: "not_implemented" });
      expect(r.ok === false && r.error).toMatch(/not built yet/i);
    }
    expect(persistApproval).not.toHaveBeenCalled();
    expect(persistNote).not.toHaveBeenCalled();
  });

  it("lists exactly the two actions that persist in Stage 1", () => {
    expect([...PERSISTED_TEACHER_ACTIONS].sort()).toEqual(["approve_next_concept", "note"]);
  });

  it("saves a note as the SESSION teacher", async () => {
    getCurrentUser.mockResolvedValue(teacher);
    persistNote.mockResolvedValue({ ok: true, data: { alreadyApplied: false } });
    const r = await applyTeacherAction(teacher, note);
    expect(r.ok).toBe(true);
    expect(persistNote).toHaveBeenCalledTimes(1);
    expect(persistNote.mock.calls[0][0]).toBe(teacherId);
  });

  it("saves an approval as the SESSION teacher, whatever identity the body claims", async () => {
    getCurrentUser.mockResolvedValue(teacher);
    persistApproval.mockResolvedValue({ ok: true, data: { alreadyApplied: false } });
    const body = { studentId, conceptId: "C3", action: "approve_next_concept", teacherId: studentId, teacher_id: studentId };
    await applyTeacherAction(teacher, body);
    expect(persistApproval).toHaveBeenCalledTimes(1);
    expect(persistApproval.mock.calls[0][0]).toBe(teacherId);
    expect(JSON.stringify(persistApproval.mock.calls[0][1])).not.toContain("teacher_id");
  });

  it("does not call persistence for a student, an unsigned caller or an invalid body", async () => {
    await applyTeacherAction({ id: studentId, role: "student" }, note);
    getCurrentUser.mockResolvedValue(null);
    await applyTeacherAction(teacher, note);
    getCurrentUser.mockResolvedValue(teacher);
    await applyTeacherAction(teacher, { studentId, conceptId: "C3", action: "approve_next_concept", overrideUnderstanding: true });
    expect(persistApproval).not.toHaveBeenCalled();
    expect(persistNote).not.toHaveBeenCalled();
  });
});

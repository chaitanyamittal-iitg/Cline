import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeacherActionErrorCode, TeacherActionResult } from "@/lib/contracts";

vi.mock("server-only", () => ({}));
const getCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured: () => true }));
const applyTeacherAction = vi.fn();
vi.mock("@/lib/learning/teacher-actions", () => ({
  applyTeacherAction: (actor: unknown, body: unknown) => applyTeacherAction(actor, body),
}));

import { POST } from "@/app/api/teacher/action/route";

const studentId = "123e4567-e89b-42d3-a456-426614174000";
const teacher = { id: "223e4567-e89b-42d3-a456-426614174001", role: "teacher" as const, displayName: "T" };
const post = () =>
  new Request("http://localhost/api/teacher/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, conceptId: "C3", action: "note", note: "n" }),
  });

const progress = {
  studentId,
  conceptId: "C3",
  state: "passed",
  supportCyclesUsed: 0,
  teacherFlagged: false,
  teacherClearedToNext: true,
};

beforeEach(() => {
  getCurrentUser.mockReset();
  applyTeacherAction.mockReset();
  getCurrentUser.mockResolvedValue(teacher);
});

describe("POST /api/teacher/action: result mapping (documented statuses)", () => {
  const cases: [TeacherActionErrorCode, number][] = [
    ["forbidden", 403],
    ["invalid_input", 400],
    ["not_found", 404],
    ["rule_violation", 409],
    ["not_implemented", 501],
    ["internal", 500],
  ];

  it.each(cases)("maps %s to HTTP %i as a JSON { ok: false, error } envelope", async (code, status) => {
    applyTeacherAction.mockResolvedValue({ ok: false, code, error: "Plain English message." } satisfies TeacherActionResult);
    const response = await POST(post());
    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(await response.json()).toEqual({ ok: false, error: "Plain English message." });
  });

  it("never turns not_implemented into success: HTTP 501, ok:false, no data", async () => {
    applyTeacherAction.mockResolvedValue({ ok: false, code: "not_implemented", error: "Saving is not built yet." });
    const response = await POST(post());
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body).not.toHaveProperty("data");
  });

  it("returns 200 with { ok: true, data } only when the backend reports success", async () => {
    const data = { progress, nextProgress: null, alreadyApplied: false };
    applyTeacherAction.mockResolvedValue({ ok: true, data });
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data });
  });
});

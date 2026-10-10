import { beforeEach, describe, expect, it, vi } from "vitest";

// Test doubles live ONLY here. The REAL route and the REAL api-auth helpers run; only the three things that need a
// browser session or a database are replaced: the session reader, the Supabase config check and the backend.
vi.mock("server-only", () => ({}));
const getCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured: () => true }));
const applyTeacherAction = vi.fn();
vi.mock("@/lib/learning/teacher-actions", () => ({
  applyTeacherAction: (actor: unknown, body: unknown) => applyTeacherAction(actor, body),
}));

import { POST } from "@/app/api/teacher/action/route";

const teacher = { id: "223e4567-e89b-42d3-a456-426614174001", role: "teacher" as const, displayName: "Ms. Rao" };
const student = { id: "123e4567-e89b-42d3-a456-426614174000", role: "student" as const, displayName: "Student A" };
const studentId = student.id;
const noteBody = { studentId, conceptId: "C3", action: "note", note: "Spoke to the student." };

const post = (body: string) =>
  new Request("http://localhost/api/teacher/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
const json = (value: unknown) => JSON.stringify(value);

beforeEach(() => {
  getCurrentUser.mockReset();
  applyTeacherAction.mockReset();
  getCurrentUser.mockResolvedValue(teacher);
});

describe("POST /api/teacher/action: API-safe authentication (never a redirect)", () => {
  it("answers 401 JSON when nobody is signed in, without reading the body or calling the backend", async () => {
    getCurrentUser.mockResolvedValue(null);
    const request = post(json(noteBody));
    const readBody = vi.spyOn(request, "json");
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.json()).toEqual({ ok: false, error: "Please sign in first." });
    expect(readBody).not.toHaveBeenCalled();
    expect(applyTeacherAction).not.toHaveBeenCalled();
  });

  it("answers 403 JSON for a signed-in student, with no redirect and no backend call", async () => {
    getCurrentUser.mockResolvedValue(student);
    const response = await POST(post(json(noteBody)));
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(response.headers.get("location")).toBeNull();
    expect((await response.json()).ok).toBe(false);
    expect(applyTeacherAction).not.toHaveBeenCalled();
  });

  it("hands the SERVER session teacher to the backend, never an actor from the browser", async () => {
    applyTeacherAction.mockResolvedValue({ ok: false, code: "not_implemented", error: "x" });
    await POST(post(json({ ...noteBody, actor: { id: studentId, role: "teacher" }, teacherId: studentId })));
    expect(applyTeacherAction).toHaveBeenCalledTimes(1);
    const [actor, body] = applyTeacherAction.mock.calls[0];
    expect(actor).toBe(teacher);
    expect(JSON.stringify(body)).not.toMatch(/actor|teacherId/); // off-contract fields never reach the backend
  });

  it("does not call a redirecting guard anywhere", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/app/api/teacher/action/route.ts", "utf8");
    const code = source.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(code).not.toMatch(/requireTeacher|requireStudent|\bredirect\s*\(/);
    expect(code).toMatch(/authenticateApi\("teacher"\)/);
  });
});

describe("POST /api/teacher/action: request body", () => {
  it.each(["{not json", "", "undefined"])("answers 400 JSON for malformed JSON (%j) without calling the backend", async (raw) => {
    const response = await POST(post(raw));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(String(body.error)).not.toMatch(/Unexpected token|SyntaxError|\bat \w/);
    expect(applyTeacherAction).not.toHaveBeenCalled();
  });

  it("answers 400 JSON for a body that is off-contract, without calling the backend", async () => {
    const response = await POST(post(json({ studentId, conceptId: "C3", action: "set_score" })));
    expect(response.status).toBe(400);
    expect((await response.json()).ok).toBe(false);
    expect(applyTeacherAction).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

// Test doubles live ONLY here. The real route is imported unchanged; its two collaborators are replaced.
vi.mock("server-only", () => ({}));
const requireTeacher = vi.fn();
vi.mock("@/lib/auth", () => ({ requireTeacher: () => requireTeacher() }));
const applyTeacherAction = vi.fn();
vi.mock("@/lib/learning/teacher-actions", () => ({
  applyTeacherAction: (actor: unknown, body: unknown) => applyTeacherAction(actor, body),
}));

import { POST } from "@/app/api/teacher/action/route";

const teacher = { id: "223e4567-e89b-42d3-a456-426614174001", role: "teacher", displayName: "Ms. Rao" };
const studentId = "123e4567-e89b-42d3-a456-426614174000";
const noteBody = { studentId, conceptId: "C3", action: "note", note: "Spoke to the student." };

const post = (body: string) =>
  new Request("http://localhost/api/teacher/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

type Redirected = { digest?: string };
const caught = (promise: Promise<unknown>) => promise.then(() => null, (e: unknown) => e as Redirected);

beforeEach(() => {
  requireTeacher.mockReset();
  applyTeacherAction.mockReset();
  requireTeacher.mockResolvedValue(teacher);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/teacher/action: authentication", () => {
  it("calls requireTeacher() first, before the body is read", async () => {
    const order: string[] = [];
    requireTeacher.mockImplementation(async () => {
      order.push("auth");
      return teacher;
    });
    applyTeacherAction.mockImplementation(async () => {
      order.push("apply");
      return { ok: false, code: "not_implemented", error: "x" };
    });
    const request = post(JSON.stringify(noteBody));
    const original = request.json.bind(request);
    request.json = async () => {
      order.push("read-body");
      return original();
    };
    await POST(request);
    expect(order).toEqual(["auth", "read-body", "apply"]);
  });

  it("preserves the redirect from requireTeacher(): it is neither caught nor turned into JSON", async () => {
    requireTeacher.mockImplementation(async () => redirect("/login"));
    const request = post(JSON.stringify(noteBody));
    const readBody = vi.spyOn(request, "json");

    const error = await caught(POST(request));
    expect(error).not.toBeNull();
    expect(String(error?.digest)).toMatch(/^NEXT_REDIRECT/);
    expect(String(error?.digest)).toContain("/login");
    expect(applyTeacherAction).not.toHaveBeenCalled();
    expect(readBody).not.toHaveBeenCalled();
  });

  it("preserves the redirect for a signed-in student as well", async () => {
    requireTeacher.mockImplementation(async () => redirect("/student"));
    const error = await caught(POST(post(JSON.stringify(noteBody))));
    expect(String(error?.digest)).toContain("/student");
    expect(applyTeacherAction).not.toHaveBeenCalled();
  });

  it("hands the SERVER session teacher to the backend, never an actor from the browser", async () => {
    applyTeacherAction.mockResolvedValue({ ok: false, code: "not_implemented", error: "x" });
    const spoof = { ...noteBody, actor: { id: studentId, role: "teacher" }, teacherId: studentId, role: "teacher" };
    await POST(post(JSON.stringify(spoof)));
    expect(applyTeacherAction).toHaveBeenCalledTimes(1);
    const [actor, body] = applyTeacherAction.mock.calls[0];
    expect(actor).toBe(teacher);
    expect(body).toEqual(spoof); // passed through untouched; the backend ignores and validates it
  });
});

describe("POST /api/teacher/action: request body", () => {
  it.each(["{not json", "", "undefined"])("returns a plain 400 for malformed JSON (%j)", async (raw) => {
    const response = await POST(post(raw));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({ ok: false, code: "invalid_input" });
    expect(String(json.error)).toMatch(/not valid JSON/i);
    expect(String(json.error)).not.toMatch(/Unexpected token|SyntaxError|at /);
    expect(applyTeacherAction).not.toHaveBeenCalled();
  });
});

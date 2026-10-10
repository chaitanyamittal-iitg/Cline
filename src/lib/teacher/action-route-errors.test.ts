import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

vi.mock("server-only", () => ({}));
const requireTeacher = vi.fn();
vi.mock("@/lib/auth", () => ({ requireTeacher: () => requireTeacher() }));
const applyTeacherAction = vi.fn();
vi.mock("@/lib/learning/teacher-actions", () => ({
  applyTeacherAction: (actor: unknown, body: unknown) => applyTeacherAction(actor, body),
}));

import { POST } from "@/app/api/teacher/action/route";

const teacher = { id: "223e4567-e89b-42d3-a456-426614174001", role: "teacher", displayName: "Ms. Rao" };
const post = () =>
  new Request("http://localhost/api/teacher/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId: "123e4567-e89b-42d3-a456-426614174000", conceptId: "C3", action: "note", note: "n" }),
  });

let logged: string[];
beforeEach(() => {
  requireTeacher.mockReset();
  applyTeacherAction.mockReset();
  requireTeacher.mockResolvedValue(teacher);
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
});

describe("POST /api/teacher/action: error safety", () => {
  it("hides raw exception text, stack traces and credentials when the backend throws", async () => {
    applyTeacherAction.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.1:5432 key=FAKE_TEST_TOKEN_123 at Object.<anonymous> (/srv/app.js:1:1)"),
    );
    const response = await POST(post());
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(text).toMatch(/Something went wrong on the server/);
    expect(text).not.toMatch(/ECONNREFUSED|FAKE_TEST_TOKEN|\.js:|Object\.<anonymous>|stack/i);
    expect(logged.join(" ")).not.toMatch(/ECONNREFUSED|FAKE_TEST_TOKEN/);
  });

  it("replaces the backend's own 'internal' message with fixed safe wording", async () => {
    applyTeacherAction.mockResolvedValue({ ok: false, code: "internal", error: "duplicate key value violates constraint x_pkey" });
    const response = await POST(post());
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(JSON.stringify(json)).not.toMatch(/duplicate key|constraint|x_pkey/);
    expect(json.code).toBe("internal");
  });

  it("still lets a Next.js redirect thrown inside the backend through, not as a 500", async () => {
    applyTeacherAction.mockImplementation(async () => redirect("/login"));
    const error = await POST(post()).then(
      () => null,
      (e: unknown) => e as { digest?: string },
    );
    expect(String(error?.digest)).toMatch(/^NEXT_REDIRECT/);
  });

  it("does not retry the backend call on failure", async () => {
    applyTeacherAction.mockRejectedValue(new Error("boom"));
    await POST(post());
    expect(applyTeacherAction).toHaveBeenCalledTimes(1);
  });
});

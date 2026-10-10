import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
const getCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
const isSupabaseConfigured = vi.fn(() => true);
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured: () => isSupabaseConfigured() }));

import { authenticateApi, readJsonBody, serviceResponse, teacherActionResponse, teacherActionStatus } from "./api-auth";
import { fail, ok } from "./result";

const student = { id: "123e4567-e89b-42d3-a456-426614174000", role: "student" as const, displayName: "Student A" };
const teacher = { id: "223e4567-e89b-42d3-a456-426614174001", role: "teacher" as const, displayName: "Ms. Rao" };

beforeEach(() => {
  getCurrentUser.mockReset();
  isSupabaseConfigured.mockReset();
  isSupabaseConfigured.mockReturnValue(true);
});

async function bodyOf(r: Response) {
  return { status: r.status, type: r.headers.get("content-type"), json: await r.json() };
}

describe("authenticateApi (API-safe: JSON, never a redirect)", () => {
  it("answers 401 JSON when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const r = await authenticateApi("student");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const res = await bodyOf(r.response);
    expect(res.status).toBe(401);
    expect(res.type).toMatch(/application\/json/);
    expect(res.json).toEqual({ ok: false, error: "Please sign in first." });
    expect(r.response.headers.get("location")).toBeNull();
  });

  it("answers 403 JSON when a teacher calls a student route, and the reverse", async () => {
    getCurrentUser.mockResolvedValue(teacher);
    const a = await authenticateApi("student");
    expect(a.ok).toBe(false);
    if (!a.ok) {
      const res = await bodyOf(a.response);
      expect(res.status).toBe(403);
      expect(res.json.ok).toBe(false);
      expect(res.type).toMatch(/application\/json/);
    }
    getCurrentUser.mockResolvedValue(student);
    const b = await authenticateApi("teacher");
    expect(b.ok).toBe(false);
    if (!b.ok) {
      const res = await bodyOf(b.response);
      expect(res.status).toBe(403);
      expect(res.json.ok).toBe(false);
      expect(b.response.headers.get("location")).toBeNull();
    }
  });

  it("returns the session user when the role matches", async () => {
    getCurrentUser.mockResolvedValue(student);
    expect(await authenticateApi("student")).toEqual({ ok: true, user: student });
  });

  it("answers 503 JSON when Supabase is not configured or the session cannot be read", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    const a = await authenticateApi("student");
    expect(a.ok === false && (await bodyOf(a.response)).status).toBe(503);
    isSupabaseConfigured.mockReturnValue(true);
    getCurrentUser.mockRejectedValue(new Error("boom with secret detail"));
    const b = await authenticateApi("student");
    expect(b.ok).toBe(false);
    if (!b.ok) {
      const res = await bodyOf(b.response);
      expect(res.status).toBe(503);
      expect(JSON.stringify(res.json)).not.toContain("secret detail");
    }
  });
});

describe("readJsonBody", () => {
  const schema = z.object({ n: z.number() });
  const post = (body: string) => new Request("http://x.test/api", { method: "POST", body });

  it("accepts a valid body", async () => {
    expect(await readJsonBody(post('{"n":1}'), schema)).toEqual({ ok: true, data: { n: 1 } });
  });
  it("answers 400 JSON for malformed JSON and for a body that breaks the contract", async () => {
    for (const bad of ["not json", '{"n":"x"}']) {
      const r = await readJsonBody(post(bad), schema);
      expect(r.ok).toBe(false);
      if (!r.ok) expect((await bodyOf(r.response)).status).toBe(400);
    }
  });
});

describe("response helpers", () => {
  it("wraps service results in the ApiResult envelope with their status", async () => {
    expect(await bodyOf(serviceResponse(ok({ a: 1 })))).toMatchObject({ status: 200, json: { ok: true, data: { a: 1 } } });
    expect(await bodyOf(serviceResponse(fail(409, "No."))))
      .toMatchObject({ status: 409, json: { ok: false, error: "No." } });
  });

  it("maps teacher error codes to the documented HTTP statuses", () => {
    expect(teacherActionStatus("forbidden")).toBe(403);
    expect(teacherActionStatus("invalid_input")).toBe(400);
    expect(teacherActionStatus("not_found")).toBe(404);
    expect(teacherActionStatus("rule_violation")).toBe(409);
    expect(teacherActionStatus("not_implemented")).toBe(501);
    expect(teacherActionStatus("internal")).toBe(500);
  });

  it("turns a teacher result into JSON", async () => {
    const res = await bodyOf(teacherActionResponse({ ok: false, code: "rule_violation", error: "Needs a note." }));
    expect(res).toMatchObject({ status: 409, json: { ok: false, error: "Needs a note." } });
  });
});

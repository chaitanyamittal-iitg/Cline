import { describe, expect, it } from "vitest";
import { NOT_READY_MESSAGE, SESSION_MESSAGE, classifyResponse, type ResponseLike } from "./action-response";

const studentId = "123e4567-e89b-42d3-a456-426614174000";
const progress = {
  studentId,
  conceptId: "C3",
  state: "passed",
  supportCyclesUsed: 0,
  teacherFlagged: false,
  teacherClearedToNext: true,
};
const success = { ok: true, data: { progress, nextProgress: null, alreadyApplied: false } };

function res(over: {
  status?: number;
  redirected?: boolean;
  type?: string;
  contentType?: string | null;
  json?: () => Promise<unknown>;
  body?: unknown;
}): ResponseLike {
  const status = over.status ?? 200;
  const contentType = over.contentType === undefined ? "application/json" : over.contentType;
  return {
    status,
    ok: status >= 200 && status < 300,
    redirected: over.redirected ?? false,
    type: over.type ?? "basic",
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : null) },
    json: over.json ?? (async () => over.body),
  };
}

describe("classifyResponse: authentication redirects are never success", () => {
  it("treats a followed redirect (login page HTML) as an unverified session, without parsing it", async () => {
    let parsed = false;
    const out = await classifyResponse(
      res({ redirected: true, contentType: "text/html; charset=utf-8", json: async () => ((parsed = true), {}) }),
    );
    expect(out).toEqual({ kind: "session", message: SESSION_MESSAGE });
    expect(parsed).toBe(false);
  });

  it("treats an opaque redirect or a 3xx as an unverified session", async () => {
    expect((await classifyResponse(res({ type: "opaqueredirect", status: 0 }))).kind).toBe("session");
    expect((await classifyResponse(res({ status: 307, contentType: null }))).kind).toBe("session");
  });

  it("treats any non-JSON answer as an unverified session and never reads the body", async () => {
    let parsed = false;
    const out = await classifyResponse(res({ contentType: "text/html", json: async () => ((parsed = true), {}) }));
    expect(out.kind).toBe("session");
    expect(parsed).toBe(false);
    expect((await classifyResponse(res({ contentType: null }))).kind).toBe("session");
  });

  it("does not let a redirected response that happens to be JSON count as saved", async () => {
    expect((await classifyResponse(res({ redirected: true, body: success }))).kind).toBe("session");
  });
});

describe("classifyResponse: 501 and backend refusals", () => {
  it("shows the exact not-ready message for HTTP 501, never as saved", async () => {
    const out = await classifyResponse(
      res({ status: 501, body: { ok: false, code: "not_implemented", error: "Teacher action 'note' is valid, but saving it is not built yet." } }),
    );
    expect(out).toEqual({ kind: "not_ready", message: "Saving is not ready yet. Your changes have not been saved." });
    expect(NOT_READY_MESSAGE).toBe("Saving is not ready yet. Your changes have not been saved.");
  });

  it("treats 501 as not ready even if the body claims ok:true", async () => {
    expect((await classifyResponse(res({ status: 501, body: success }))).kind).not.toBe("saved");
  });

  it("keeps the backend's plain-English message and code for rule violations", async () => {
    const out = await classifyResponse(
      res({ status: 409, body: { ok: false, code: "rule_violation", error: "Approving needs an override and a note." } }),
    );
    expect(out).toEqual({ kind: "rejected", code: "rule_violation", message: "Approving needs an override and a note." });
  });

  it("reports an unknown code on an unrecognised status as unexpected, never as saved", async () => {
    expect((await classifyResponse(res({ status: 418, body: { ok: false, code: "weird", error: "x" } }))).kind).toBe("unexpected");
  });

  it("falls back to the HTTP status when the body has an unknown code", async () => {
    const out = await classifyResponse(res({ status: 400, body: { ok: false, code: "weird", error: "x" } }));
    expect(out).toEqual({ kind: "rejected", code: "invalid_input", message: "x" });
  });
});

describe("classifyResponse: the real route's envelope has no code, only the HTTP status", () => {
  const failure = (status: number, error: string) => res({ status, body: { ok: false, error } });

  it("treats 401 as an unverified session with a sign-in link, never as a rejection or success", async () => {
    expect(await classifyResponse(failure(401, "Please sign in first."))).toEqual({ kind: "session", message: SESSION_MESSAGE });
  });

  it.each([
    [400, "invalid_input"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "rule_violation"],
    [500, "internal"],
    [503, "internal"],
  ] as const)("maps HTTP %i to %s and keeps the plain-English message", async (status, code) => {
    expect(await classifyResponse(failure(status, "Plain message."))).toEqual({ kind: "rejected", code, message: "Plain message." });
  });

  it("shows the exact not-ready message for a codeless 501", async () => {
    expect(await classifyResponse(failure(501, "Teacher action 'clear_flag' is valid, but saving it is not built yet."))).toEqual({
      kind: "not_ready",
      message: "Saving is not ready yet. Your changes have not been saved.",
    });
  });

  it("treats an unrecognised failing status without a code as unexpected", async () => {
    expect((await classifyResponse(failure(418, "teapot"))).kind).toBe("unexpected");
  });
});

describe("classifyResponse: only a valid 2xx success is saved", () => {
  it("accepts the documented success shape", async () => {
    expect(await classifyResponse(res({ body: success }))).toEqual({ kind: "saved", data: success.data });
  });

  it("rejects malformed JSON, wrong shapes and ok:true with a failing status", async () => {
    const bad = async () => {
      throw new SyntaxError("x");
    };
    expect((await classifyResponse(res({ json: bad }))).kind).toBe("unexpected");
    expect((await classifyResponse(res({ body: "text" }))).kind).toBe("unexpected");
    expect((await classifyResponse(res({ body: { ok: true } }))).kind).toBe("unexpected");
    expect((await classifyResponse(res({ body: { ok: true, data: { progress: {} } } }))).kind).toBe("unexpected");
    expect((await classifyResponse(res({ status: 500, body: success }))).kind).toBe("unexpected");
  });
});

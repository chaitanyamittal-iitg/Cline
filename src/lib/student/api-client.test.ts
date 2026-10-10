import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { postForm, postJson, UNAVAILABLE_MESSAGE } from "./api-client";

const Schema = z.object({ value: z.number() });

function stubFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}
function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

afterEach(() => vi.unstubAllGlobals());

describe("postJson", () => {
  it("returns validated data for a successful response", async () => {
    stubFetch(async () => jsonResponse({ ok: true, data: { value: 3 } }));
    expect(await postJson("/api/x", {}, Schema)).toEqual({ ok: true, data: { value: 3 } });
  });

  it("sends JSON with the right method and body", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, data: { value: 1 } }));
    vi.stubGlobal("fetch", fetchMock);
    await postJson("/api/x", { a: 1 }, Schema);
    expect(fetchMock).toHaveBeenCalledWith("/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
  });

  it("never turns a network failure into success", async () => {
    stubFetch(async () => {
      throw new TypeError("network down");
    });
    const result = await postJson("/api/x", {}, Schema);
    expect(result).toEqual({ ok: false, reason: "unavailable", error: UNAVAILABLE_MESSAGE });
  });

  it("treats a missing route (an HTML page, not JSON) as unavailable", async () => {
    stubFetch(async () => ({
      ok: false,
      status: 404,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));
    const result = await postJson("/api/x", {}, Schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
  });

  it("passes on the server's plain-English refusal", async () => {
    stubFetch(async () => jsonResponse({ ok: false, error: "That is not allowed right now." }, 409));
    expect(await postJson("/api/x", {}, Schema)).toEqual({
      ok: false,
      reason: "rejected",
      error: "That is not allowed right now.",
    });
  });

  it("rejects a success response that does not match the contract", async () => {
    stubFetch(async () => jsonResponse({ ok: true, data: { value: "three" } }));
    const result = await postJson("/api/x", {}, Schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });

  it("does not trust ok:true when the HTTP status says it failed", async () => {
    stubFetch(async () => jsonResponse({ ok: true, data: { value: 3 } }, 500));
    const result = await postJson("/api/x", {}, Schema);
    expect(result.ok).toBe(false);
  });

  it("ignores an empty error string and reports the service as unavailable", async () => {
    stubFetch(async () => jsonResponse({ ok: false, error: "  " }, 500));
    const result = await postJson("/api/x", {}, Schema);
    expect(result).toEqual({ ok: false, reason: "unavailable", error: UNAVAILABLE_MESSAGE });
  });
});

describe("postForm", () => {
  it("sends the form without forcing a Content-Type (the browser sets the boundary)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, data: { value: 2 } }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("questionId", "C3-Q1");
    const result = await postForm("/api/upload", form, Schema);
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/upload", { method: "POST", body: form });
  });
});

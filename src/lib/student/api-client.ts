// Browser-side helper for calling the SAFAL API routes. Client-safe: no server imports, no secrets.
// Every response is validated against the contract schema before the UI may use it. A route that is missing,
// unreachable or returns something unexpected is reported honestly; it is never turned into a fake success.
import type { z } from "zod";

export type CallFailureReason = "unavailable" | "rejected" | "invalid";
export type CallResult<T> = { ok: true; data: T } | { ok: false; reason: CallFailureReason; error: string };

export const UNAVAILABLE_MESSAGE =
  "We could not reach the learning service. Nothing you typed has been lost. Please try again in a moment.";
export const INVALID_MESSAGE =
  "The learning service sent an answer we did not understand. Nothing you typed has been lost. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function call<S extends z.ZodType>(url: string, init: RequestInit, schema: S): Promise<CallResult<z.output<S>>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return { ok: false, reason: "unavailable", error: UNAVAILABLE_MESSAGE };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // A missing route returns an HTML page, not JSON.
    return { ok: false, reason: "unavailable", error: UNAVAILABLE_MESSAGE };
  }
  if (!isRecord(payload)) return { ok: false, reason: "unavailable", error: UNAVAILABLE_MESSAGE };

  if (payload.ok === true && response.ok) {
    const parsed = schema.safeParse(payload.data);
    if (parsed.success) return { ok: true, data: parsed.data };
    return { ok: false, reason: "invalid", error: INVALID_MESSAGE };
  }
  if (payload.ok === false && typeof payload.error === "string" && payload.error.trim().length > 0) {
    return { ok: false, reason: "rejected", error: payload.error };
  }
  return { ok: false, reason: "unavailable", error: UNAVAILABLE_MESSAGE };
}

/** POST a JSON body (same-origin; the login cookie is sent automatically). */
export function postJson<S extends z.ZodType>(url: string, body: unknown, schema: S): Promise<CallResult<z.output<S>>> {
  return call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, schema);
}

/** POST multipart form data. The browser sets the Content-Type boundary itself. */
export function postForm<S extends z.ZodType>(url: string, form: FormData, schema: S): Promise<CallResult<z.output<S>>> {
  return call(url, { method: "POST", body: form }, schema);
}

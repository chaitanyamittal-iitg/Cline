// Classifies what came back from POST /api/teacher/action. TEACHER-OWNED. Pure, no server-only: used by client forms.
// The browser must decide between "success", "backend said no", "not ready" and "session could not be verified"
// WITHOUT ever treating a redirect, HTML page or malformed body as success.
import { TeacherActionResponseSchema, type TeacherActionErrorCode } from "@/lib/contracts";
import type { z } from "zod";

export type ActionOutcome =
  | { kind: "saved"; data: z.infer<typeof TeacherActionResponseSchema> }
  /** HTTP 401 (nobody signed in), or a redirect / non-JSON answer: the teacher session could not be verified. */
  | { kind: "session"; message: string }
  /** HTTP 501 / code not_implemented. Nothing was saved. */
  | { kind: "not_ready"; message: string }
  | { kind: "rejected"; code: TeacherActionErrorCode; message: string }
  | { kind: "unexpected"; message: string };

export const NOT_READY_MESSAGE = "Saving is not ready yet. Your changes have not been saved.";
export const SESSION_MESSAGE =
  "Your teacher session could not be verified, so nothing was saved. Sign in again, then retry.";
export const UNEXPECTED_MESSAGE =
  "The server's answer could not be understood, so it is not known whether anything was saved. Reload the page to check before trying again.";
export const NETWORK_MESSAGE =
  "The request did not complete, so it is not known whether the server received it. Reload the page to check the current state before trying again.";

const CODES: readonly TeacherActionErrorCode[] = [
  "forbidden",
  "invalid_input",
  "not_found",
  "rule_violation",
  "not_implemented",
  "internal",
];

/**
 * The API-safe helpers (src/lib/learning/api-auth.ts) answer { ok: false, error } WITHOUT a code and use the HTTP status:
 * 400 invalid input, 403 not a teacher, 404 not found, 409 rule violation, 501 not implemented, 500/503 server problem.
 * (401 is handled separately: it means the session could not be verified.) A code in the body, if present, is honoured.
 */
function codeFromStatus(status: number): TeacherActionErrorCode | null {
  switch (status) {
    case 400: return "invalid_input";
    case 403: return "forbidden";
    case 404: return "not_found";
    case 409: return "rule_violation";
    case 501: return "not_implemented";
    case 500:
    case 502:
    case 503: return "internal";
    default: return null;
  }
}

/** The slice of a fetch Response this needs. Keeping it small makes it testable without a network. */
export interface ResponseLike {
  status: number;
  ok: boolean;
  redirected: boolean;
  type?: string;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function classifyResponse(response: ResponseLike): Promise<ActionOutcome> {
  // 1. Redirect handling BEFORE any parsing. A followed redirect lands on /login or /student (HTML), and a
  //    manual redirect appears as an opaque redirect or a 3xx. None of these may be read as a result.
  if (response.redirected || response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    return { kind: "session", message: SESSION_MESSAGE };
  }
  // 2. Anything that is not JSON (an HTML login page, an error page) is never parsed or displayed.
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(contentType)) {
    return { kind: "session", message: SESSION_MESSAGE };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "unexpected", message: UNEXPECTED_MESSAGE };
  }
  if (!isRecord(body) || typeof body.ok !== "boolean") return { kind: "unexpected", message: UNEXPECTED_MESSAGE };

  if (body.ok === false) {
    // 401 from authenticateApi("teacher"): nobody is signed in. Never success; the form offers a sign-in link.
    if (response.status === 401) return { kind: "session", message: SESSION_MESSAGE };
    const code = CODES.find((c) => c === body.code) ?? codeFromStatus(response.status);
    const message = typeof body.error === "string" && body.error.trim() !== "" ? body.error : UNEXPECTED_MESSAGE;
    // 501 and not_implemented are never success, whatever else the body says.
    if (response.status === 501 || code === "not_implemented") return { kind: "not_ready", message: NOT_READY_MESSAGE };
    if (!code) return { kind: "unexpected", message };
    return { kind: "rejected", code, message };
  }

  // body.ok === true: only a 2xx response that matches the documented data shape counts as saved.
  if (!response.ok) return { kind: "unexpected", message: UNEXPECTED_MESSAGE };
  const parsed = TeacherActionResponseSchema.safeParse(body.data);
  if (!parsed.success) return { kind: "unexpected", message: UNEXPECTED_MESSAGE };
  return { kind: "saved", data: parsed.data };
}

/** Human wording for a confirmed success. Never produced for anything but kind "saved". */
export function describeSaved(
  action: string,
  data: z.infer<typeof TeacherActionResponseSchema>,
): { headline: string; details: string[] } {
  const details: string[] = [];
  if (data.alreadyApplied) {
    details.push("Nothing needed to change: this had already been applied, so nothing was duplicated or reset.");
  }
  if (action === "approve_next_concept") {
    if (data.nextProgress) {
      details.push(`The next concept (${data.nextProgress.conceptId}) is now recorded as ${data.nextProgress.state}.`);
    } else {
      details.push("This is the last concept, so there is no next concept to open.");
    }
  }
  return { headline: "Saved. The server confirmed this action.", details };
}

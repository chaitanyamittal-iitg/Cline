// HTTP mapping for POST /api/teacher/action. TEACHER-OWNED. Pure apart from building a Response; no server-only.
// Status codes are the documented ones in docs/CONTRACTS.md ("Backend entry point"):
//   forbidden 403, invalid_input 400, not_found 404, rule_violation 409, not_implemented 501, internal 500.
// Success is 200 with { ok: true, data }. Failures keep the contract's { ok: false, error, code } envelope.
import type { TeacherActionErrorCode, TeacherActionResult } from "@/lib/contracts";

export const HTTP_STATUS_FOR_CODE: Record<TeacherActionErrorCode, number> = {
  forbidden: 403,
  invalid_input: 400,
  not_found: 404,
  rule_violation: 409,
  not_implemented: 501,
  internal: 500,
};

export const MALFORMED_JSON_RESULT: TeacherActionResult = {
  ok: false,
  code: "invalid_input",
  error: "The request body is not valid JSON. Nothing was changed.",
};

/** Used when something unexpected is thrown. No exception text, stack trace or detail is passed on. */
export const UNEXPECTED_RESULT: TeacherActionResult = {
  ok: false,
  code: "internal",
  error: "Something went wrong on the server. Reload the page to check the current state before trying again.",
};

export function statusFor(result: TeacherActionResult): number {
  return result.ok ? 200 : HTTP_STATUS_FOR_CODE[result.code];
}

/**
 * The route never forwards a server-side "internal" message: it uses the fixed text above instead.
 * Every other code keeps the plain-English message the backend wrote for the teacher.
 */
export function toSafeResult(result: TeacherActionResult): TeacherActionResult {
  return !result.ok && result.code === "internal" ? UNEXPECTED_RESULT : result;
}

export function toJsonResponse(result: TeacherActionResult): Response {
  const safe = toSafeResult(result);
  return Response.json(safe, { status: statusFor(safe), headers: { "Cache-Control": "no-store" } });
}

// API-safe authentication for route handlers (src/app/api/**). Owned by AI and backend.
//
// WHY THIS EXISTS: requireStudent() / requireTeacher() in src/lib/auth.ts call redirect(). That is right for PAGES, but
// inside an API route a redirect turns a failed login into a 307 to the login page's HTML. A fetch() caller then
// cannot tell "not signed in" from "wrong role", and JSON parsing fails. API routes must use authenticateApi() instead:
//   not signed in -> 401 JSON, signed in with the wrong role -> 403 JSON, never a redirect.
//
// Teacher route pattern (src/app/api/teacher/action/route.ts, owned by the Teacher worker):
//
//   import { authenticateApi, readJsonBody, teacherActionResponse } from "@/lib/learning/api-auth";
//   import { TeacherActionRequestSchema } from "@/lib/contracts";
//   import { applyTeacherAction } from "@/lib/learning/teacher-actions";
//
//   export async function POST(request: Request) {
//     const auth = await authenticateApi("teacher");          // 401 / 403 JSON, no redirect
//     if (!auth.ok) return auth.response;
//     const body = await readJsonBody(request, TeacherActionRequestSchema);   // 400 JSON on bad input
//     if (!body.ok) return body.response;
//     return teacherActionResponse(await applyTeacherAction(auth.user, body.data));
//   }
//
// The acting teacher is always auth.user (the server session). Never read an actor id from the request body.
import "server-only";
import type { ZodType, z } from "zod";
import { getCurrentUser, type CurrentUser, type Role } from "@/lib/auth";
import type { TeacherActionErrorCode, TeacherActionResult } from "@/lib/contracts";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { ServiceResult } from "./result";

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status });
}

export function jsonError(error: string, status: number): Response {
  return Response.json({ ok: false, error }, { status });
}

export type ApiAuth = { ok: true; user: CurrentUser } | { ok: false; response: Response };

/** Checks the login cookie and the role. Never redirects. */
export async function authenticateApi(role: Role): Promise<ApiAuth> {
  if (!isSupabaseConfigured()) {
    return { ok: false, response: jsonError("The learning service is not configured on this server.", 503) };
  }
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (e) {
    console.error("[api-auth] could not read the session:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, response: jsonError("We could not check your login just now. Please try again.", 503) };
  }
  if (!user) return { ok: false, response: jsonError("Please sign in first.", 401) };
  if (user.role !== role) {
    return { ok: false, response: jsonError(`This is only available to ${role === "teacher" ? "teachers" : "students"}.`, 403) };
  }
  return { ok: true, user };
}

/** Parses the JSON body with a contract schema. A bad body is a 400, never an exception. */
export async function readJsonBody<S extends ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: jsonError("The request body must be JSON.", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: jsonError(parsed.error.issues[0]?.message ?? "The request is not valid.", 400) };
  }
  return { ok: true, data: parsed.data };
}

/** Turns a service result into the ApiResult envelope with its HTTP status. */
export function serviceResponse<T>(result: ServiceResult<T>): Response {
  return result.ok ? jsonOk(result.data) : jsonError(result.error, result.status);
}

const TEACHER_STATUS: Record<TeacherActionErrorCode, number> = {
  forbidden: 403,
  invalid_input: 400,
  not_found: 404,
  rule_violation: 409,
  not_implemented: 501,
  internal: 500,
};

export function teacherActionStatus(code: TeacherActionErrorCode): number {
  return TEACHER_STATUS[code];
}

/** Maps applyTeacherAction's result to JSON with the documented status codes. */
export function teacherActionResponse(result: TeacherActionResult): Response {
  return result.ok ? jsonOk(result.data) : jsonError(result.error, teacherActionStatus(result.code));
}

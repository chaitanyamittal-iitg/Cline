// POST /api/teacher/action. Owned by the Teacher dashboard (branch feat/teacher). A THIN route: no persistence here.
// 1. requireTeacher() runs first and OUTSIDE any error handling, so its redirect (to /login for a logged-out visitor,
//    to /student for a student) is preserved exactly as the lead built it. It is never swallowed or replaced.
//    PENDING Windows-lead decision: a JSON 401/403 for non-teachers. Until then a non-teacher gets that redirect,
//    and the browser form detects it and says the session could not be verified.
// 2. The body is parsed here; malformed JSON is a plain-English 400.
// 3. Everything else (authorization re-check, validation, rules, persistence) is applyTeacherAction() in
//    src/lib/learning/teacher-actions.ts, owned by AI and backend. The acting teacher is the server session user,
//    never anything the browser sends. While persistence is not built it returns not_implemented (HTTP 501):
//    this route passes that through and never turns it into success.
import { unstable_rethrow } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { applyTeacherAction } from "@/lib/learning/teacher-actions";
import { MALFORMED_JSON_RESULT, UNEXPECTED_RESULT, toJsonResponse } from "@/lib/teacher/action-http";

export async function POST(request: Request): Promise<Response> {
  const teacher = await requireTeacher();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toJsonResponse(MALFORMED_JSON_RESULT);
  }

  try {
    return toJsonResponse(await applyTeacherAction(teacher, body));
  } catch (error) {
    // Next.js control-flow errors must keep working; anything else becomes a fixed, safe message.
    unstable_rethrow(error);
    console.error("[teacher] /api/teacher/action failed unexpectedly");
    return toJsonResponse(UNEXPECTED_RESULT);
  }
}

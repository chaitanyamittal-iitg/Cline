// POST /api/teacher/action. Owned by the Teacher dashboard (branch feat/teacher). A THIN route: no persistence here.
// It follows the API-safe pattern in docs/BACKEND_STAGE1.md, using the helpers in src/lib/learning/api-auth.ts:
//   - authenticateApi("teacher") answers 401 JSON when nobody is signed in and 403 JSON for a student. It never sends
//     a browser redirect, so fetch() callers always get JSON they can read.
//   - readJsonBody() answers 400 JSON for malformed or off-contract bodies.
//   - the acting teacher is auth.user (the server session), never anything in the request body.
// Authorization, rules and persistence live in applyTeacherAction() (src/lib/learning/teacher-actions.ts, owned by
// AI and backend). Today approve_next_concept and note persist; the other three actions answer not_implemented
// (HTTP 501), which this route passes through unchanged and never turns into success.
import { TeacherActionRequestSchema } from "@/lib/contracts";
import { authenticateApi, readJsonBody, teacherActionResponse } from "@/lib/learning/api-auth";
import { applyTeacherAction } from "@/lib/learning/teacher-actions";

export async function POST(request: Request) {
  const auth = await authenticateApi("teacher"); // not signed in -> 401 JSON, a student -> 403 JSON, never a redirect
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request, TeacherActionRequestSchema); // malformed or off-contract -> 400 JSON
  if (!body.ok) return body.response;
  return teacherActionResponse(await applyTeacherAction(auth.user, body.data));
}

// POST /api/progress/advance: the student finished the lesson and reading and moves to the doubt step.
// Not signed in -> 401 JSON, a teacher -> 403 JSON (never a redirect). The student id is the session user's.
import { AdvanceProgressRequestSchema } from "@/lib/contracts";
import { authenticateApi, readJsonBody, serviceResponse } from "@/lib/learning/api-auth";
import { advanceProgress } from "@/lib/learning/progress-service";

export async function POST(request: Request) {
  const auth = await authenticateApi("student");
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request, AdvanceProgressRequestSchema);
  if (!body.ok) return body.response;
  return serviceResponse(await advanceProgress(auth.user.id, body.data));
}

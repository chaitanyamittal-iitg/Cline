// POST /api/answers/follow-up: the student answers ONE open clarification and the SAME attempt resumes.
// A clarification never uses up a support/reassessment cycle.
import { FollowUpRequestSchema } from "@/lib/contracts";
import { authenticateApi, readJsonBody, serviceResponse } from "@/lib/learning/api-auth";
import { submitFollowUp } from "@/lib/learning/answers-service";

export async function POST(request: Request) {
  const auth = await authenticateApi("student");
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request, FollowUpRequestSchema);
  if (!body.ok) return body.response;
  return serviceResponse(await submitFollowUp(auth.user.id, body.data));
}

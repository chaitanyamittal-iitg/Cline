// POST /api/answers: the student submits the answers of one sitting (typed text in this stage).
// Right/wrong only, never a number. AI output carries its source ("mock" or "live").
import { SubmitAnswersRequestSchema } from "@/lib/contracts";
import { authenticateApi, readJsonBody, serviceResponse } from "@/lib/learning/api-auth";
import { submitAnswers } from "@/lib/learning/answers-service";

export async function POST(request: Request) {
  const auth = await authenticateApi("student");
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request, SubmitAnswersRequestSchema);
  if (!body.ok) return body.response;
  return serviceResponse(await submitAnswers(auth.user.id, body.data));
}

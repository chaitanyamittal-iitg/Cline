// POST /api/attempts/start: the student has no more doubts; opens the predefined written micro-test. Idempotent.
import { StartMicrotestRequestSchema } from "@/lib/contracts";
import { authenticateApi, readJsonBody, serviceResponse } from "@/lib/learning/api-auth";
import { startMicrotest } from "@/lib/learning/progress-service";

export async function POST(request: Request) {
  const auth = await authenticateApi("student");
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request, StartMicrotestRequestSchema);
  if (!body.ok) return body.response;
  return serviceResponse(await startMicrotest(auth.user.id, body.data.conceptId));
}

// Teacher actions: the ONE function the teacher route calls. Owned by AI and backend after this milestone
// (the interface below was settled by the lead; change it only through the lead).
//
// STATUS: authorization and validation are real. PERSISTENCE IS NOT BUILT YET, so a valid request from a real
// teacher returns { ok: false, code: "not_implemented" }. It never returns a fake success and never writes.
// The AI-and-backend owner replaces the final step; see "Persistence checklist" in docs/CONTRACTS.md.
import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { TeacherActionInputSchema, type TeacherActionResult } from "@/lib/contracts";

/** Flip to true only when every action in docs/CONTRACTS.md "Persistence checklist" is implemented and tested. */
export const TEACHER_ACTIONS_PERSISTENCE_READY = false;

/** What the route passes in: the result of requireTeacher(). It is re-checked here, never trusted. */
export type TeacherActor = Pick<CurrentUser, "id" | "role">;

const forbidden: TeacherActionResult = { ok: false, code: "forbidden", error: "Only the signed-in teacher can do this." };

/**
 * Route usage (src/app/api/teacher/action/route.ts, owned by the Teacher worker):
 *
 *   const teacher = await requireTeacher();                      // redirects anyone who is not a teacher
 *   const result = await applyTeacherAction(teacher, await request.json());
 *   // map result.code to HTTP: forbidden 403, invalid_input 400, not_found 404, rule_violation 409,
 *   // not_implemented 501, internal 500. Success is 200 with { ok: true, data }.
 *
 * Order inside: (1) authorization, (2) validation, (3) privileged writes. The acting teacher is the session user.
 * The request body has no teacher id, and a student id in the body only names the TARGET.
 */
export async function applyTeacherAction(actor: TeacherActor, rawInput: unknown): Promise<TeacherActionResult> {
  // 1. Authorization, from the real session, before anything else. A made-up `actor` cannot pass this.
  if (actor.role !== "teacher") return forbidden;
  const session = await getCurrentUser();
  if (!session || session.role !== "teacher" || session.id !== actor.id) return forbidden;

  // 2. Validation against the shared contract.
  const parsed = TeacherActionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "invalid_input", error: parsed.error.issues[0]?.message ?? "The request is not valid." };
  }

  // 3. Privileged writes (admin client, teacher id = session.id). Deferred on purpose: no fake success.
  return {
    ok: false,
    code: "not_implemented",
    error:
      `Teacher action '${parsed.data.action}' is valid, but saving it is not built yet. ` +
      "Nothing was changed. The AI and backend owner is implementing it (docs/CONTRACTS.md, Persistence checklist).",
  };
}

// Teacher actions: the ONE function the teacher route calls. Owned by AI and backend after this milestone
// (the interface below was settled by the lead; change it only through the lead).
//
// STATUS: authorization, validation and persistence of approve_next_concept and note are real (Stage 1).
// override_diagnosis, assign_support and clear_flag still return { ok: false, code: "not_implemented" } and write
// nothing. It never returns a fake success; see "Persistence checklist" in docs/CONTRACTS.md.
import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { TeacherActionInputSchema, type TeacherActionKind, type TeacherActionResult } from "@/lib/contracts";
import { persistApproval, persistNote } from "./teacher-persist";

/** Flip to true only when every action in docs/CONTRACTS.md "Persistence checklist" is implemented and tested. */
export const TEACHER_ACTIONS_PERSISTENCE_READY = false;

/** Stage 1: these two persist for real. The other three still return { code: "not_implemented" }. */
export const PERSISTED_TEACHER_ACTIONS: readonly TeacherActionKind[] = ["approve_next_concept", "note"];

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

  // 3. Privileged writes (admin client). The acting teacher is the SESSION user, never anything from the body.
  const input = parsed.data;
  switch (input.action) {
    case "approve_next_concept":
      return persistApproval(session.id, input);
    case "note":
      return persistNote(session.id, input);
    default:
      // override_diagnosis, assign_support and clear_flag come in a later stage. No fake success, no write.
      return {
        ok: false,
        code: "not_implemented",
        error:
          `Teacher action '${input.action}' is valid, but saving it is not built yet. ` +
          "Nothing was changed. The AI and backend owner is implementing it (docs/CONTRACTS.md, Persistence checklist).",
      };
  }
}

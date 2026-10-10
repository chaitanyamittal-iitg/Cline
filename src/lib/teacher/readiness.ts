// Which teacher actions the backend can actually save. TEACHER-OWNED. Server only.
// Reads the real list from the AI-and-backend module so the page tells the teacher the truth. It is read on the
// SERVER and passed to client forms as plain data: client components never import teacher-actions.ts.
// TEACHER_ACTIONS_PERSISTENCE_READY stays false until ALL five actions persist, so it cannot say which ones do;
// PERSISTED_TEACHER_ACTIONS is the backend's own list of the ones that do (Stage 1: approve_next_concept and note).
import "server-only";
import type { TeacherActionKind } from "@/lib/contracts";
import { PERSISTED_TEACHER_ACTIONS, TEACHER_ACTIONS_PERSISTENCE_READY } from "@/lib/learning/teacher-actions";
import type { ActionAvailability } from "./availability";

export function teacherActionAvailability(): ActionAvailability {
  // The backend declares the flag as a literal; widen it so this keeps compiling when the backend flips it to true.
  const everythingReady: boolean = TEACHER_ACTIONS_PERSISTENCE_READY;
  const persisted: readonly TeacherActionKind[] = PERSISTED_TEACHER_ACTIONS;
  const can = (action: TeacherActionKind) => everythingReady || persisted.includes(action);
  return {
    approve_next_concept: can("approve_next_concept"),
    note: can("note"),
    clear_flag: can("clear_flag"),
    assign_support: can("assign_support"),
    override_diagnosis: can("override_diagnosis"),
  };
}

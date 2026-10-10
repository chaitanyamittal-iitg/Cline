// Whether the backend can actually save teacher actions. TEACHER-OWNED. Server only.
// Reads the real flag from the AI-and-backend module so the page can tell the teacher the truth. It is read on the
// SERVER and passed to client forms as a plain boolean: client components never import teacher-actions.ts.
import "server-only";
import { TEACHER_ACTIONS_PERSISTENCE_READY } from "@/lib/learning/teacher-actions";

export function teacherActionSavingReady(): boolean {
  // The backend declares the flag as a literal (today `false`). Widen it to boolean so this keeps compiling and
  // reports the real value when the backend owner flips it to true.
  const ready: boolean = TEACHER_ACTIONS_PERSISTENCE_READY;
  return ready;
}

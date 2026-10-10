// Which teacher actions can currently be saved. TEACHER-OWNED. Pure type: safe to import from client components.
// The server computes it (see readiness.ts) and passes it down as plain data.
export interface ActionAvailability {
  approve_next_concept: boolean;
  note: boolean;
  clear_flag: boolean;
  assign_support: boolean;
  override_diagnosis: boolean;
}

/** Shown above an action the backend cannot save yet. The form still talks to the real route. */
export const UNAVAILABLE_NOTICE =
  "Saving this action is not available yet. You can fill in the form, but nothing will be saved, and the server will say so.";

// Read-only query for the /teacher student list. TEACHER-OWNED. Server only.
// Uses the teacher's own session (RLS applies). No admin client, no writes, no hardcoded students.
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchRows } from "./fetch";
import { buildProgressViews } from "./linking";
import {
  ConceptRowSchema,
  ProfileRowSchema,
  ProgressRowSchema,
  type ConceptProgressView,
  type SectionResult,
  type StudentIdentity,
} from "./types";

export interface StudentListEntry {
  student: StudentIdentity;
  /** Failed progress query is kept distinct from "this student has no progress rows". */
  progress: SectionResult<ConceptProgressView[]>;
}

export type StudentListResult =
  | { ok: true; students: StudentListEntry[]; conceptTitlesAvailable: boolean }
  | { ok: false; message: string };

export async function loadStudentList(): Promise<StudentListResult> {
  const sb = await createSupabaseServerClient();

  const profiles = await fetchRows("The student list", ProfileRowSchema, () =>
    sb.from("profiles").select("id, role, display_name, class_label").eq("role", "student").order("display_name"),
  );
  if (!profiles.ok) return { ok: false, message: profiles.message };
  if (profiles.data.length === 0) return { ok: true, students: [], conceptTitlesAvailable: true };

  const ids = profiles.data.map((p) => p.id);
  const [progress, concepts] = await Promise.all([
    fetchRows("Concept progress", ProgressRowSchema, () =>
      sb
        .from("concept_progress")
        .select("student_id, concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next")
        .in("student_id", ids),
    ),
    fetchRows("Concept titles", ConceptRowSchema, () =>
      sb.from("concepts").select("id, position, title").order("position"),
    ),
  ]);

  const conceptRows = concepts.ok ? concepts.data : null;
  const students = profiles.data.map((p): StudentListEntry => ({
    student: { id: p.id, displayName: p.display_name, classLabel: p.class_label },
    progress: progress.ok
      ? { ok: true, data: buildProgressViews(progress.data.filter((row) => row.student_id === p.id), conceptRows) }
      : { ok: false, message: progress.message },
  }));
  return { ok: true, students, conceptTitlesAvailable: concepts.ok };
}

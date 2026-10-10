// Read-only queries for the student screens, made with the SIGNED-IN student's own session
// (row-level security applies). No admin client, no writes, and no answer-key tables are touched.
// When a query fails we return an error result; we never substitute made-up data.
import "server-only";
import { ConceptIdSchema, ConceptProgressSchema, type ApiResult, type ConceptId, type ConceptProgress } from "@/lib/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ConceptSummary } from "./progress";

export interface LessonResource {
  id: string;
  title: string;
  url: string | null;
  body: string | null;
}

export interface DashboardData {
  concepts: ConceptSummary[];
  progress: ConceptProgress[];
}

export interface LessonView {
  concept: ConceptSummary;
  progress: ConceptProgress;
  /** Approved recorded lessons only (resources.kind = 'lecture_video', approved = true). */
  videos: LessonResource[];
  /** Approved reading only (resources.kind = 'reading', approved = true). */
  readings: LessonResource[];
}

const LOAD_ERROR = "We could not load your learning right now. Please try again in a moment.";

interface ProgressRow {
  student_id: string;
  concept_id: string;
  state: string;
  support_cycles_used: number;
  teacher_flagged: boolean;
  teacher_cleared_to_next: boolean;
}

export function toProgress(row: ProgressRow): ConceptProgress | null {
  const parsed = ConceptProgressSchema.safeParse({
    studentId: row.student_id,
    conceptId: row.concept_id,
    state: row.state,
    supportCyclesUsed: row.support_cycles_used,
    teacherFlagged: row.teacher_flagged,
    teacherClearedToNext: row.teacher_cleared_to_next,
  });
  return parsed.success ? parsed.data : null;
}

export function toConcept(row: { id: string; position: number; title: string; objective: string }): ConceptSummary | null {
  const id = ConceptIdSchema.safeParse(row.id);
  return id.success ? { id: id.data, position: row.position, title: row.title, objective: row.objective } : null;
}

function fail<T>(where: string, message: string): ApiResult<T> {
  console.error(`[student] ${where}: ${message}`);
  return { ok: false, error: LOAD_ERROR };
}

/** The signed-in student's concepts and their own progress rows. Creates nothing. */
export async function getDashboardData(studentId: string): Promise<ApiResult<DashboardData>> {
  try {
    const supabase = await createSupabaseServerClient();
    const [conceptsRes, progressRes] = await Promise.all([
      supabase.from("concepts").select("id, position, title, objective").order("position", { ascending: true }),
      supabase
        .from("concept_progress")
        .select("student_id, concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next")
        .eq("student_id", studentId),
    ]);
    if (conceptsRes.error) return fail("dashboard concepts", conceptsRes.error.message);
    if (progressRes.error) return fail("dashboard progress", progressRes.error.message);

    const concepts = (conceptsRes.data ?? []).map(toConcept).filter((c): c is ConceptSummary => c !== null);
    const progress = (progressRes.data ?? []).map(toProgress).filter((p): p is ConceptProgress => p !== null);
    return { ok: true, data: { concepts, progress } };
  } catch (error) {
    return fail("dashboard", error instanceof Error ? error.message : "unknown error");
  }
}

/**
 * Lesson and reading for one concept. A student may open a concept only when the database already holds a
 * progress row for them on it (only the server or a teacher action creates those rows), so a future concept
 * cannot be opened by editing the URL. Returns data: null when the student has no access (or no such concept);
 * in that case no resource is even requested.
 */
export async function getLessonView(studentId: string, conceptId: ConceptId): Promise<ApiResult<LessonView | null>> {
  try {
    const supabase = await createSupabaseServerClient();

    const progressRes = await supabase
      .from("concept_progress")
      .select("student_id, concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next")
      .eq("student_id", studentId)
      .eq("concept_id", conceptId)
      .maybeSingle();
    if (progressRes.error) return fail("lesson progress", progressRes.error.message);
    if (!progressRes.data) return { ok: true, data: null };
    const progress = toProgress(progressRes.data);
    if (!progress) return fail("lesson progress", "unexpected progress row");

    const [conceptRes, resourcesRes] = await Promise.all([
      supabase.from("concepts").select("id, position, title, objective").eq("id", conceptId).maybeSingle(),
      supabase
        .from("resources")
        .select("id, kind, title, url, body, position")
        .eq("concept_id", conceptId)
        .eq("approved", true)
        .in("kind", ["lecture_video", "reading"])
        .order("position", { ascending: true }),
    ]);
    if (conceptRes.error) return fail("lesson concept", conceptRes.error.message);
    if (resourcesRes.error) return fail("lesson resources", resourcesRes.error.message);
    if (!conceptRes.data) return { ok: true, data: null };
    const concept = toConcept(conceptRes.data);
    if (!concept) return { ok: true, data: null };

    const videos: LessonResource[] = [];
    const readings: LessonResource[] = [];
    for (const r of resourcesRes.data ?? []) {
      const item: LessonResource = { id: r.id, title: r.title, url: r.url, body: r.body };
      if (r.kind === "lecture_video") videos.push(item);
      else if (r.kind === "reading") readings.push(item);
    }
    return { ok: true, data: { concept, progress, videos, readings } };
  } catch (error) {
    return fail("lesson", error instanceof Error ? error.message : "unknown error");
  }
}

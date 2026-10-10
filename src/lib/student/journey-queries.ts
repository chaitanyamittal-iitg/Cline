// Read-only queries for the doubt, written-test, support and reassessment screens.
// Made with the SIGNED-IN student's own session (row-level security applies). No admin client, no writes, and no
// answer-key table (question_keys, generated_question_keys) is ever touched. Nothing is created on page load.
// When a read fails we return an error; we never substitute made-up data.
import "server-only";
import { AiSourceSchema, TeacherSupportContentSchema, type ApiResult, type ConceptId } from "@/lib/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { JourneyData, TeacherSupportView, TutorMessageView, VisualResourceView } from "./journey-types";
import { toConcept, toProgress } from "./queries";
import { fail, loadLatestSitting } from "./sitting-queries";

/**
 * Everything the post-lesson screens need for one concept, read with the student's own session.
 * Returns data: null when the student has no progress row for the concept (so a future concept cannot be opened).
 */
export async function getJourneyData(studentId: string, conceptId: ConceptId): Promise<ApiResult<JourneyData | null>> {
  try {
    const supabase = await createSupabaseServerClient();

    const progressRes = await supabase
      .from("concept_progress")
      .select("student_id, concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next")
      .eq("student_id", studentId)
      .eq("concept_id", conceptId)
      .maybeSingle();
    if (progressRes.error) return fail("journey progress", progressRes.error.message);
    if (!progressRes.data) return { ok: true, data: null };
    const progress = toProgress(progressRes.data);
    if (!progress) return fail("journey progress", "unexpected progress row");

    const [conceptRes, messagesRes, visualsRes, teacherRes, sittingRes] = await Promise.all([
      supabase.from("concepts").select("id, position, title, objective").eq("id", conceptId).maybeSingle(),
      supabase
        .from("tutor_messages")
        .select("id, role, content, resource_id, ai_source")
        .eq("student_id", studentId)
        .eq("concept_id", conceptId)
        .order("created_at", { ascending: true }),
      supabase
        .from("resources")
        .select("id, kind, title, url, body")
        .eq("concept_id", conceptId)
        .eq("approved", true)
        .in("kind", ["diagram", "graphic", "video"])
        .order("position", { ascending: true }),
      supabase
        .from("teacher_actions")
        .select("id, payload")
        .eq("student_id", studentId)
        .eq("concept_id", conceptId)
        .eq("action", "assign_support")
        .order("created_at", { ascending: true }),
      loadLatestSitting(supabase, studentId, conceptId),
    ]);
    if (conceptRes.error) return fail("journey concept", conceptRes.error.message);
    if (messagesRes.error) return fail("journey tutor messages", messagesRes.error.message);
    if (visualsRes.error) return fail("journey resources", visualsRes.error.message);
    if (teacherRes.error) return fail("journey teacher support", teacherRes.error.message);
    if (!sittingRes.ok) return sittingRes;
    if (!conceptRes.data) return { ok: true, data: null };
    const concept = toConcept(conceptRes.data);
    if (!concept) return { ok: true, data: null };

    const messages: TutorMessageView[] = (messagesRes.data ?? []).flatMap((m) => {
      if (m.role !== "student" && m.role !== "tutor") return [];
      const source = AiSourceSchema.safeParse(m.ai_source);
      return [
        {
          id: m.id,
          role: m.role,
          content: m.content,
          resourceId: m.resource_id,
          source: m.role === "tutor" && source.success ? source.data : null,
        },
      ];
    });

    const visuals: VisualResourceView[] = (visualsRes.data ?? []).flatMap((r) =>
      r.kind === "diagram" || r.kind === "graphic" || r.kind === "video"
        ? [{ id: r.id, kind: r.kind, title: r.title, url: r.url, body: r.body }]
        : [],
    );

    const teacherSupport: TeacherSupportView[] = (teacherRes.data ?? []).flatMap((t) => {
      const payload = (t.payload ?? {}) as { support?: unknown };
      const parsed = TeacherSupportContentSchema.safeParse(payload.support);
      return parsed.success ? [{ id: t.id, content: parsed.data }] : [];
    });

    return { ok: true, data: { concept, progress, messages, visuals, ...sittingRes.data, teacherSupport } };
  } catch (error) {
    return fail("journey", error instanceof Error ? error.message : "unknown error");
  }
}

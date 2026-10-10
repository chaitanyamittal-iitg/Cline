// Reads the student's latest sitting (micro-test or reassessment) with saved answers, feedback and support plan.
// Session-scoped and read-only: no admin client, no writes, no answer-key tables. Creates nothing.
import "server-only";
import { SupportPlanSchema, type ApiResult, type ConceptId, type SupportPlan } from "@/lib/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PromptQuestion, SittingView } from "./journey-types";
import { buildPersistedFeedback, type PersistedAnswerRow, type PersistedDiagnosisRow } from "./persisted-feedback";

export const LOAD_ERROR = "We could not load your learning right now. Please try again in a moment.";

export function fail<T>(where: string, message: string): ApiResult<T> {
  console.error(`[student] ${where}: ${message}`);
  return { ok: false, error: LOAD_ERROR };
}

/** Reads only id and prompt from the stored questions; any other property is ignored on purpose. */
export function parseQuestions(raw: unknown): PromptQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptQuestion[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const { id, prompt } = item as { id?: unknown; prompt?: unknown };
      if (typeof id === "string" && typeof prompt === "string") out.push({ id, prompt });
    }
  }
  return out;
}

export interface SittingBundle {
  sitting: SittingView | null;
  support: SupportPlan | null;
  /** True when a reassessment exists but its support plan could not be read. */
  supportUnreadable: boolean;
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function loadLatestSitting(
  supabase: Supabase,
  studentId: string,
  conceptId: ConceptId,
): Promise<ApiResult<SittingBundle>> {
  const attemptRes = await supabase
    .from("attempts")
    .select("id, kind, cycle, questions, ai_source")
    .eq("student_id", studentId)
    .eq("concept_id", conceptId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (attemptRes.error) return fail("journey attempts", attemptRes.error.message);

  const latest = attemptRes.data?.[0];
  if (!latest || (latest.kind !== "microtest" && latest.kind !== "reassessment")) {
    return { ok: true, data: { sitting: null, support: null, supportUnreadable: false } };
  }

  const answersRes = await supabase
    .from("answers")
    .select("id, question_id, kind, clarifies_answer_id, typed_text, confirmed_text, upload_path")
    .eq("student_id", studentId)
    .eq("attempt_id", latest.id)
    .order("created_at", { ascending: true });
  if (answersRes.error) return fail("journey answers", answersRes.error.message);
  const answerRows: PersistedAnswerRow[] = answersRes.data ?? [];

  let diagnosisRows: PersistedDiagnosisRow[] = [];
  if (answerRows.length > 0) {
    const diagRes = await supabase
      .from("diagnoses")
      .select(
        "answer_id, concept_id, is_correct, reasoning_sound, misconception, evidence, next_action, follow_up_question, ai_source, created_at",
      )
      .eq("student_id", studentId)
      .in("answer_id", answerRows.map((a) => a.id));
    if (diagRes.error) return fail("journey diagnoses", diagRes.error.message);
    diagnosisRows = diagRes.data ?? [];
  }

  const questions = parseQuestions(latest.questions);
  const sitting: SittingView = {
    attemptId: latest.id,
    kind: latest.kind,
    cycle: latest.cycle,
    source: latest.ai_source === "mock" || latest.ai_source === "live" ? latest.ai_source : null,
    questions,
    feedback: buildPersistedFeedback(questions, answerRows, diagnosisRows),
  };
  if (latest.kind !== "reassessment") return { ok: true, data: { sitting, support: null, supportUnreadable: false } };

  const cycleRes = await supabase
    .from("support_cycles")
    .select("support")
    .eq("student_id", studentId)
    .eq("concept_id", conceptId)
    .eq("reassessment_attempt_id", latest.id)
    .maybeSingle();
  if (cycleRes.error) return fail("journey support", cycleRes.error.message);
  const parsed = cycleRes.data ? SupportPlanSchema.safeParse(cycleRes.data.support) : null;
  return {
    ok: true,
    data: { sitting, support: parsed?.success ? parsed.data : null, supportUnreadable: !parsed?.success },
  };
}

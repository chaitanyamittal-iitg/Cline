// Loaders for one sitting (a micro-test or a reassessment) and the hidden material needed to diagnose it.
// Every read is filtered by the CALLER'S OWN id, so a student can never load another student's attempt even though
// the admin client bypasses row-level security. A missing attempt and someone else's attempt look the same (404).
import "server-only";
import type { ConceptId } from "@/lib/contracts";
import type { ApprovedResource } from "@/lib/ai/types";
import type { Db } from "./db";
import { fail, ok, type ServiceResult } from "./result";
import type { SavedAnswerRow, SavedDiagnosisRow } from "./assess";

const LOAD_FAILED = "We could not load that just now. Please try again in a moment.";

export interface PromptQuestion {
  id: string;
  prompt: string;
}

export interface OwnedAttempt {
  id: string;
  kind: "microtest" | "reassessment";
  cycle: number;
  questions: PromptQuestion[];
}

/** Reads only id and prompt; anything else stored in the JSON is ignored on purpose. */
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

export async function loadOwnedAttempt(
  db: Db,
  studentId: string,
  conceptId: ConceptId,
  attemptId: string,
): Promise<ServiceResult<OwnedAttempt>> {
  const { data, error } = await db
    .from("attempts")
    .select("id, kind, cycle, questions")
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .eq("concept_id", conceptId)
    .maybeSingle();
  if (error) {
    console.error("[learning] loadOwnedAttempt:", error.message);
    return fail(500, LOAD_FAILED);
  }
  if (!data || (data.kind !== "microtest" && data.kind !== "reassessment")) {
    return fail(404, "We could not find that test.");
  }
  const questions = parseQuestions(data.questions);
  if (questions.length === 0) {
    console.error("[learning] loadOwnedAttempt: attempt has no readable questions");
    return fail(500, LOAD_FAILED);
  }
  return ok({ id: data.id, kind: data.kind, cycle: data.cycle, questions });
}

export interface SavedSitting {
  answers: SavedAnswerRow[];
  diagnoses: SavedDiagnosisRow[];
}

export async function loadSaved(db: Db, studentId: string, attemptId: string): Promise<ServiceResult<SavedSitting>> {
  const answersRes = await db
    .from("answers")
    .select("id, question_id, kind, clarifies_answer_id, typed_text, confirmed_text, upload_path")
    .eq("student_id", studentId)
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: true });
  if (answersRes.error) {
    console.error("[learning] loadSaved answers:", answersRes.error.message);
    return fail(500, LOAD_FAILED);
  }
  const answers = (answersRes.data ?? []) as SavedAnswerRow[];
  if (answers.length === 0) return ok({ answers, diagnoses: [] });

  const diagRes = await db
    .from("diagnoses")
    .select("answer_id, concept_id, is_correct, reasoning_sound, misconception, evidence, next_action, follow_up_question, ai_source, created_at")
    .eq("student_id", studentId)
    .in("answer_id", answers.map((a) => a.id));
  if (diagRes.error) {
    console.error("[learning] loadSaved diagnoses:", diagRes.error.message);
    return fail(500, LOAD_FAILED);
  }
  return ok({ answers, diagnoses: (diagRes.data ?? []) as SavedDiagnosisRow[] });
}

export interface HiddenKey {
  expectedIdea: string;
  misconceptions: string[];
}

/** The answer key for each question of this sitting. Server only: it is never put in a response. */
export async function loadKeys(db: Db, attempt: OwnedAttempt): Promise<ServiceResult<Map<string, HiddenKey>>> {
  const ids = attempt.questions.map((q) => q.id);
  const keys = new Map<string, HiddenKey>();
  if (attempt.kind === "microtest") {
    const { data, error } = await db
      .from("question_keys")
      .select("question_id, expected_idea, common_misconceptions")
      .in("question_id", ids);
    if (error) {
      console.error("[learning] loadKeys microtest:", error.message);
      return fail(500, LOAD_FAILED);
    }
    for (const row of data ?? []) {
      keys.set(row.question_id, { expectedIdea: row.expected_idea, misconceptions: row.common_misconceptions ?? [] });
    }
  } else {
    const { data, error } = await db
      .from("generated_question_keys")
      .select("question_id, expected_idea")
      .eq("attempt_id", attempt.id);
    if (error) {
      console.error("[learning] loadKeys reassessment:", error.message);
      return fail(500, LOAD_FAILED);
    }
    for (const row of data ?? []) keys.set(row.question_id, { expectedIdea: row.expected_idea, misconceptions: [] });
  }
  if (ids.some((id) => !keys.has(id))) {
    console.error("[learning] loadKeys: a question has no answer key");
    return fail(500, "This test is not set up correctly yet. Please tell your teacher.");
  }
  return ok(keys);
}

/** Only teacher-approved resources may ever reach the AI. */
export async function loadApprovedResources(db: Db, conceptId: ConceptId): Promise<ServiceResult<ApprovedResource[]>> {
  const { data, error } = await db
    .from("resources")
    .select("id, concept_id, kind, title, body")
    .eq("concept_id", conceptId)
    .eq("approved", true)
    .order("position", { ascending: true });
  if (error) {
    console.error("[learning] loadApprovedResources:", error.message);
    return fail(500, LOAD_FAILED);
  }
  return ok(
    (data ?? []).map((r) => ({ id: r.id, conceptId: r.concept_id, kind: r.kind, title: r.title, body: r.body ?? null })),
  );
}

/** Evidence from this student's earlier diagnoses on this concept, so one slip is not the whole picture. */
export async function loadEarlierEvidence(db: Db, studentId: string, conceptId: ConceptId): Promise<string[]> {
  const { data, error } = await db
    .from("diagnoses")
    .select("evidence")
    .eq("student_id", studentId)
    .eq("concept_id", conceptId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.error("[learning] loadEarlierEvidence:", error.message);
    return [];
  }
  return (data ?? []).map((r) => String(r.evidence));
}

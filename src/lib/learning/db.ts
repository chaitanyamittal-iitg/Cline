// Database access for the learning services. Owned by AI and backend.
// The admin client BYPASSES row-level security, so every service here must first prove who the caller is (the route
// does that with authenticateApi) and must then filter every read and write by that user's own id.
import "server-only";
import { ConceptProgressSchema, type ConceptProgress } from "@/lib/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { fail, ok, type ServiceResult } from "./result";

export type Db = ReturnType<typeof createSupabaseAdminClient>;

export function openDb(): ServiceResult<Db> {
  try {
    return ok(createSupabaseAdminClient());
  } catch (e) {
    console.error("[learning] admin client unavailable:", e instanceof Error ? e.message : "unknown error");
    return fail(503, "The learning service is not configured on this server.");
  }
}

/** concept_progress as stored (snake_case). */
export interface ProgressRow {
  id?: string;
  student_id: string;
  concept_id: string;
  state: string;
  support_cycles_used: number;
  teacher_flagged: boolean;
  teacher_cleared_to_next: boolean;
}

export function toProgress(row: ProgressRow | null | undefined): ConceptProgress | null {
  if (!row) return null;
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

export type RpcOutcome = { ok: true; body: Record<string, unknown> } | { ok: false };

/** Calls one of the atomic functions from migration 0007. A missing function is logged for the developer only. */
export async function callRpc(db: Db, fn: string, args: Record<string, unknown>): Promise<RpcOutcome> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    const hint = error.code === "PGRST202" ? " (has migration 0007 been applied?)" : "";
    console.error(`[learning] ${fn} failed: ${error.message}${hint}`);
    return { ok: false };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    console.error(`[learning] ${fn} returned an unexpected value`);
    return { ok: false };
  }
  return { ok: true, body: data as Record<string, unknown> };
}

export function progressFromRpc(value: unknown): ConceptProgress | null {
  return value && typeof value === "object" ? toProgress(value as ProgressRow) : null;
}

export async function loadProgress(
  db: Db,
  studentId: string,
  conceptId: string,
): Promise<ServiceResult<{ row: ProgressRow; progress: ConceptProgress }>> {
  const { data, error } = await db
    .from("concept_progress")
    .select("id, student_id, concept_id, state, support_cycles_used, teacher_flagged, teacher_cleared_to_next")
    .eq("student_id", studentId)
    .eq("concept_id", conceptId)
    .maybeSingle();
  if (error) {
    console.error("[learning] loadProgress:", error.message);
    return fail(500, "We could not load your progress just now. Please try again in a moment.");
  }
  const row = data as ProgressRow | null;
  if (!row) return fail(404, "You have not started this concept yet.");
  const progress = toProgress(row);
  if (!progress) {
    console.error("[learning] loadProgress: stored progress did not match the contract");
    return fail(500, "We could not load your progress just now. Please try again in a moment.");
  }
  return ok({ row, progress });
}

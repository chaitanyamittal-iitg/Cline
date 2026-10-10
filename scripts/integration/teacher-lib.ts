// Shared pieces for the teacher integration checks. If /api/teacher/action EXISTS (the Teacher worker owns it), teacher
// actions go through that route over real HTTP with the real teacher session. If it does NOT exist, they fall back to
// calling persistApproval / persistNote DIRECTLY and the output says so: that proves database behaviour only, never the
// route. Nothing here resets any data.
import { isJson, listOf, post, type Session } from "./http-lib";

export const ROUTE = "/api/teacher/action";
export type Body = Record<string, unknown>;
export interface Outcome {
  ok: boolean;
  status: number | null;
  data: Record<string, unknown> | null;
  error: string;
}

export async function auditCount(teacher: Session, studentId: string): Promise<number> {
  const { data, error } = await teacher.db.from("teacher_actions").select("id, action").eq("student_id", studentId);
  if (error) throw new Error(`could not read teacher_actions as the teacher: ${error.message}`);
  return listOf(data).filter((r) => ["approve_next_concept", "note"].includes(String(r.action))).length;
}

export async function routeExists(): Promise<boolean> {
  const probe = await post(ROUTE, { studentId: "00000000-0000-0000-0000-000000000000", conceptId: "C3", action: "note", note: "probe" });
  return !(probe.status === 404 && !isJson(probe));
}

export function makeActor(teacherId: string, teacher: Session, viaHttp: boolean) {
  return async function act(body: Body): Promise<Outcome> {
    if (viaHttp) {
      const r = await post(ROUTE, body, teacher);
      return { ok: r.json?.ok === true, status: r.status, data: (r.json?.data as Record<string, unknown>) ?? null, error: r.json?.error ?? "" };
    }
    const { persistApproval, persistNote } = await import("@/lib/learning/teacher-persist");
    const result = body.action === "note" ? await persistNote(teacherId, body as never) : await persistApproval(teacherId, body as never);
    return result.ok
      ? { ok: true, status: null, data: result.data as unknown as Record<string, unknown>, error: "" }
      : { ok: false, status: null, data: null, error: `${result.code}: ${result.error}` };
  };
}

export const progressOf = (o: Outcome) => (o.data?.progress ?? {}) as Record<string, unknown>;

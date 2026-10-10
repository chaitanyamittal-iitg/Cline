// Small pure helpers shared by the teacher read layer. TEACHER-OWNED (unit-tested in linking.test.ts).
// Record linking itself lives in attempts.ts and support.ts and uses ONLY real foreign keys.
import type { AnswerRow, AttemptRow, ConceptProgressView, ConceptRow, ProgressRow } from "./types";

export function byCreatedThenId<T extends { created_at: string; id: string }>(a: T, b: T): number {
  const x = Date.parse(a.created_at);
  const y = Date.parse(b.created_at);
  if (!Number.isNaN(x) && !Number.isNaN(y) && x !== y) return x - y;
  return a.id.localeCompare(b.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** attempts.questions is jsonb [{id, prompt}]. Items that do not match are skipped, never guessed. */
export function parseAttemptQuestions(raw: unknown): { id: string; prompt: string | null }[] {
  if (!Array.isArray(raw)) return [];
  const out: { id: string; prompt: string | null }[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    out.push({ id: item.id, prompt: typeof item.prompt === "string" ? item.prompt : null });
  }
  return out;
}

/** Ids of every question the stored attempts and answers mention. Used to fetch fallback prompts. */
export function collectQuestionIds(attempts: AttemptRow[], answers: AnswerRow[]): string[] {
  const ids = new Set<string>();
  for (const attempt of attempts) for (const q of parseAttemptQuestions(attempt.questions)) ids.add(q.id);
  for (const answer of answers) ids.add(answer.question_id);
  return [...ids];
}

/** Groups by concept, ordered by concepts.position. If concept titles are unavailable the concept id is the title. */
export function buildProgressViews(progress: ProgressRow[], concepts: ConceptRow[] | null): ConceptProgressView[] {
  const byId = new Map((concepts ?? []).map((c) => [c.id, c]));
  return progress
    .map((row) => {
      const concept = byId.get(row.concept_id);
      return {
        conceptId: row.concept_id,
        conceptTitle: concept?.title ?? row.concept_id,
        position: concept?.position ?? Number.MAX_SAFE_INTEGER,
        state: row.state,
        supportCyclesUsed: row.support_cycles_used,
        teacherFlagged: row.teacher_flagged,
        teacherClearedToNext: row.teacher_cleared_to_next,
      };
    })
    .sort((a, b) => a.position - b.position || a.conceptId.localeCompare(b.conceptId));
}

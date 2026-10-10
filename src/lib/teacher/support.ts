// Support-cycle display logic. TEACHER-OWNED. Pure (unit-tested in support.test.ts).
// support_cycles.support is jsonb. The keys read here come from the committed SupportPlan contract
// (src/lib/contracts/learning.ts). Any other stored content is shown as formatted JSON: never dropped, never interpreted.
import { byCreatedThenId } from "./linking";
import type { AttemptRow, DiagnosisRow, SupportCycleRow } from "./types";
import type { LinkedLookup, SupportCycleView, SupportDisplay } from "./view-types";

const TEXT_FIELDS: { key: string; label: string }[] = [
  { key: "targetMisconception", label: "Misconception targeted" },
  { key: "explanation", label: "Explanation" },
  { key: "guidingQuestion", label: "Guiding question" },
  { key: "practiceTask", label: "Practice task" },
];

// SupportPlan keys (src/lib/contracts/learning.ts) that repeat facts already shown from real columns:
// source -> ai_source, cycleNumber -> cycle_number, conceptId -> concept_id. They are not shown a second time.
const COLUMN_DUPLICATES = new Set(["source", "cycleNumber", "conceptId"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function describeSupport(support: unknown): SupportDisplay {
  if (typeof support === "string") {
    return { fields: [{ label: "Support", value: support }], resourceIds: [], other: null };
  }
  if (!isRecord(support)) {
    const other = support === null || support === undefined ? null : JSON.stringify(support, null, 2);
    return { fields: [], resourceIds: [], other };
  }

  const fields: { label: string; value: string }[] = [];
  const leftover: Record<string, unknown> = {};
  let resourceIds: string[] = [];

  for (const [key, value] of Object.entries(support)) {
    const textField = TEXT_FIELDS.find((f) => f.key === key);
    if (textField && typeof value === "string") {
      if (value.trim() !== "") fields.push({ label: textField.label, value });
    } else if (key === "resourceIds" && Array.isArray(value) && value.every((v) => typeof v === "string")) {
      resourceIds = value as string[];
    } else if (COLUMN_DUPLICATES.has(key)) {
      continue;
    } else {
      leftover[key] = value;
    }
  }
  // Keep the contract's reading order regardless of the stored key order.
  fields.sort((a, b) => TEXT_FIELDS.findIndex((f) => f.label === a.label) - TEXT_FIELDS.findIndex((f) => f.label === b.label));

  const other = Object.keys(leftover).length > 0 ? JSON.stringify(leftover, null, 2) : null;
  return { fields, resourceIds, other };
}

function lookup<T extends { id: string }>(id: string | null, pool: T[] | null): LinkedLookup<T> {
  if (id === null) return { state: "none" };
  if (pool === null) return { state: "unavailable" };
  const found = pool.find((item) => item.id === id);
  return found ? { state: "found", value: found } : { state: "unavailable" };
}

export function buildSupportCycleViews(
  cycles: SupportCycleRow[],
  diagnoses: DiagnosisRow[] | null,
  attempts: AttemptRow[] | null,
): SupportCycleView[] {
  return [...cycles]
    .sort((a, b) => a.cycle_number - b.cycle_number || byCreatedThenId(a, b))
    .map((cycle) => ({
      cycle,
      display: describeSupport(cycle.support),
      triggerDiagnosis: lookup(cycle.diagnosis_id, diagnoses),
      reassessmentAttempt: lookup(cycle.reassessment_attempt_id, attempts),
    }));
}

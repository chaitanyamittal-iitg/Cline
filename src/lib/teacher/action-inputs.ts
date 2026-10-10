// Builds and pre-checks teacher-action requests in the browser. TEACHER-OWNED. Pure, no server-only.
// The limits below are copied from the merged contract (src/lib/contracts/learning.ts) and every built request is
// re-checked against TeacherActionInputSchema, so a form can never send something the contract would reject
// unnoticed. The server still validates again: this is only to give the teacher a clear message first.
import { TeacherActionInputSchema, type ConceptId, type TeacherActionInput } from "@/lib/contracts";

export const LIMITS = {
  note: 2000,
  explanation: 2000,
  guidingQuestion: 1000,
  practiceTask: 1000,
  misconception: 500,
  resources: 5,
} as const;

export type BuildResult =
  | { ok: true; input: TeacherActionInput }
  | { ok: false; errors: Record<string, string> };

export interface Target {
  studentId: string;
  conceptId: ConceptId;
}

const required = (value: string) => value.trim() !== "";

function finish(candidate: unknown, errors: Record<string, string>): BuildResult {
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const parsed = TeacherActionInputSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, input: parsed.data };
  // The form checks above should catch everything; this is the contract's own verdict as a safety net.
  return { ok: false, errors: { form: parsed.error.issues[0]?.message ?? "The request is not valid." } };
}

function tooLong(errors: Record<string, string>, field: string, value: string, max: number, label: string) {
  if (value.trim().length > max) errors[field] = `${label} must be ${max} characters or fewer.`;
}

export function buildApproval(
  target: Target,
  form: { state: string; override: boolean; note: string },
): BuildResult {
  const errors: Record<string, string> = {};
  // Any state other than "passed" needs the explicit override box and a note. The server re-checks this rule.
  const needsOverride = form.state !== "passed";
  if (needsOverride) {
    if (!form.override) {
      errors.override = "This student has not passed. Tick the override box to approve progression anyway.";
    }
    if (!required(form.note)) errors.note = "A note is required when approving a student who has not passed.";
  }
  tooLong(errors, "note", form.note, LIMITS.note, "The note");
  const candidate = {
    ...target,
    action: "approve_next_concept",
    ...(needsOverride && form.override ? { overrideUnderstanding: true } : {}),
    ...(required(form.note) ? { note: form.note } : {}),
  };
  return finish(candidate, errors);
}

export function buildClearFlag(target: Target, form: { note: string }): BuildResult {
  const errors: Record<string, string> = {};
  tooLong(errors, "note", form.note, LIMITS.note, "The note");
  return finish({ ...target, action: "clear_flag", ...(required(form.note) ? { note: form.note } : {}) }, errors);
}

export function buildNote(target: Target, form: { note: string }): BuildResult {
  const errors: Record<string, string> = {};
  if (!required(form.note)) errors.note = "Write a note first.";
  tooLong(errors, "note", form.note, LIMITS.note, "The note");
  return finish({ ...target, action: "note", note: form.note }, errors);
}

export function buildAssignSupport(
  target: Target,
  form: { explanation: string; guidingQuestion: string; practiceTask: string; resourceIds: string[]; note: string },
): BuildResult {
  const errors: Record<string, string> = {};
  if (!required(form.explanation)) errors.explanation = "An explanation is required.";
  tooLong(errors, "explanation", form.explanation, LIMITS.explanation, "The explanation");
  tooLong(errors, "guidingQuestion", form.guidingQuestion, LIMITS.guidingQuestion, "The guiding question");
  tooLong(errors, "practiceTask", form.practiceTask, LIMITS.practiceTask, "The practice task");
  tooLong(errors, "note", form.note, LIMITS.note, "The note");
  if (form.resourceIds.length > LIMITS.resources) errors.resourceIds = `Choose at most ${LIMITS.resources} resources.`;
  const candidate = {
    ...target,
    action: "assign_support",
    support: {
      explanation: form.explanation,
      guidingQuestion: required(form.guidingQuestion) ? form.guidingQuestion : null,
      practiceTask: required(form.practiceTask) ? form.practiceTask : null,
      resourceIds: form.resourceIds,
    },
    ...(required(form.note) ? { note: form.note } : {}),
  };
  return finish(candidate, errors);
}

export function buildOverride(
  target: Target,
  form: {
    diagnosisId: string;
    isCorrect: boolean;
    reasoningSound: boolean;
    misconception: string;
    reason: string;
  },
): BuildResult {
  const errors: Record<string, string> = {};
  if (!form.diagnosisId) errors.diagnosisId = "Choose the diagnosis to override.";
  if (!required(form.reason)) errors.reason = "A reason is required: say why you disagree with the AI.";
  tooLong(errors, "reason", form.reason, LIMITS.note, "The reason");
  tooLong(errors, "misconception", form.misconception, LIMITS.misconception, "The misconception");
  const hasMisconception = required(form.misconception);
  if (form.isCorrect && form.reasoningSound && hasMisconception) {
    errors.misconception = "A correct answer with sound reasoning cannot also name a misconception.";
  }
  const candidate = {
    ...target,
    action: "override_diagnosis",
    diagnosisId: form.diagnosisId,
    replacement: {
      isCorrect: form.isCorrect,
      reasoningSound: form.reasoningSound,
      misconception: hasMisconception ? form.misconception : null,
    },
    note: form.reason,
  };
  return finish(candidate, errors);
}

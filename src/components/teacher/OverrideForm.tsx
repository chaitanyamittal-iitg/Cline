"use client";
// Override ONE existing diagnosis for ONE student and ONE concept. TEACHER-OWNED. Client component.
// The diagnosis is chosen from the student's REAL stored diagnoses for this concept (their real ids are sent; none are
// invented). The replacement has exactly the contract's fields: isCorrect, reasoningSound, misconception (500, or none).
// The original AI diagnosis and the student's work are never edited: the backend records the replacement separately.
import { useState, type FormEvent } from "react";
import { LIMITS, buildOverride, type Target } from "@/lib/teacher/action-inputs";
import { correctnessLabel, formatTimestamp, nextActionLabel, reasoningLabel } from "@/lib/teacher/labels";
import type { DiagnosisOption } from "@/lib/teacher/options";
import type { SectionResult } from "@/lib/teacher/types";
import { ActionFeedback } from "./ActionFeedback";
import { SectionError } from "./SectionError";
import { Checkbox, FormError, SubmitRow, TextArea } from "./FormFields";
import { SourceBadge } from "./SourceBadge";
import { useActionSubmit } from "./useActionSubmit";
import styles from "./teacher.module.css";

export function OverrideForm({ target, diagnoses }: { target: Target; diagnoses: SectionResult<DiagnosisOption[]> }) {
  const { submit, pending, outcome } = useActionSubmit();
  const [diagnosisId, setDiagnosisId] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [reasoningSound, setReasoningSound] = useState(false);
  const [misconception, setMisconception] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const options = diagnoses.ok ? diagnoses.data.filter((d) => d.conceptId === target.conceptId) : [];
  const selected = options.find((d) => d.id === diagnosisId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const built = buildOverride(target, { diagnosisId, isCorrect, reasoningSound, misconception, reason });
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    await submit(built.input);
  }

  return (
    <form className={styles.actionForm} onSubmit={onSubmit} noValidate aria-label={`Override a diagnosis for ${target.conceptId}`}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={pending}>
        <legend>Override a diagnosis</legend>
        <p className={styles.fieldHelp}>
          Records what you believe the diagnosis should have been. The original AI diagnosis and the student&rsquo;s work are kept
          exactly as they are, and this does not approve progression.
        </p>
        {!diagnoses.ok ? (
          <SectionError message={diagnoses.message} />
        ) : options.length === 0 ? (
          <p className="muted">No stored diagnosis exists for this student and concept, so there is nothing to override.</p>
        ) : (
          <>
            <label htmlFor={`diag-${target.conceptId}`}>Diagnosis to override (required)</label>
            <select
              id={`diag-${target.conceptId}`}
              value={diagnosisId}
              onChange={(event) => setDiagnosisId(event.target.value)}
              aria-invalid={errors.diagnosisId ? true : undefined}
            >
              <option value="">Choose a stored diagnosis…</option>
              {options.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatTimestamp(d.createdAt)} — {d.misconception ?? "no misconception recorded"}
                </option>
              ))}
            </select>
            <FormError message={errors.diagnosisId} />

            {selected && (
              <div className={styles.diagnosisSummary}>
                <div className={styles.inlineRow}>
                  <strong>Original diagnosis</strong>
                  <SourceBadge source={selected.source} />
                </div>
                <p>{correctnessLabel(selected.isCorrect)}</p>
                <p>{reasoningLabel(selected.reasoningSound)}</p>
                <p>Next action: {nextActionLabel(selected.nextAction)}</p>
              </div>
            )}

            <fieldset className={styles.radioGroup}>
              <legend>Your replacement</legend>
              <Checkbox label="The answer is correct" checked={isCorrect} onChange={setIsCorrect} />
              <Checkbox label="The reasoning is sound" checked={reasoningSound} onChange={setReasoningSound} />
            </fieldset>
            <TextArea
              label="Misconception"
              value={misconception}
              onChange={setMisconception}
              max={LIMITS.misconception}
              error={errors.misconception}
              help="Leave empty if there is none. A correct answer with sound reasoning cannot name one."
            />
            <TextArea
              label="Reason for overriding the AI"
              value={reason}
              onChange={setReason}
              max={LIMITS.note}
              required
              error={errors.reason}
            />
            <FormError message={errors.form} />
            <SubmitRow pending={pending} label="Record override" pendingLabel="Sending…" />
          </>
        )}
      </fieldset>
      <ActionFeedback outcome={outcome} />
    </form>
  );
}

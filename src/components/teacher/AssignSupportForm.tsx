"use client";
// Assign teacher-written support for ONE student and ONE concept. TEACHER-OWNED. Client component.
// Fields are exactly the contract's TeacherSupportContent: explanation (required, 2000), guidingQuestion (1000, optional),
// practiceTask (1000, optional) and up to 5 resourceIds. Resource choices are REAL approved resources of this concept,
// supplied by the server; none are invented. This adds support beside any automated support: it does not touch the
// support-cycle count and never starts a third automated cycle.
import { useState, type FormEvent } from "react";
import { LIMITS, buildAssignSupport, type Target } from "@/lib/teacher/action-inputs";
import type { ResourceOption } from "@/lib/teacher/options";
import type { SectionResult } from "@/lib/teacher/types";
import { ActionFeedback } from "./ActionFeedback";
import { FormError, SubmitRow, TextArea } from "./FormFields";
import { SectionError } from "./SectionError";
import { useActionSubmit } from "./useActionSubmit";
import styles from "./teacher.module.css";

export function AssignSupportForm({ target, resources }: { target: Target; resources: SectionResult<ResourceOption[]> }) {
  const { submit, pending, outcome } = useActionSubmit();
  const [explanation, setExplanation] = useState("");
  const [guidingQuestion, setGuidingQuestion] = useState("");
  const [practiceTask, setPracticeTask] = useState("");
  const [note, setNote] = useState("");
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const choices = resources.ok ? resources.data.filter((r) => r.conceptId === target.conceptId) : [];

  function toggle(id: string) {
    setResourceIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const built = buildAssignSupport(target, { explanation, guidingQuestion, practiceTask, resourceIds, note });
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    await submit(built.input);
  }

  return (
    <form className={styles.actionForm} onSubmit={onSubmit} noValidate aria-label={`Assign support for ${target.conceptId}`}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={pending}>
        <legend>Assign support</legend>
        <p className={styles.fieldHelp}>
          Adds your own support beside any automated support. It does not change the support-cycle count and does not start
          another automated cycle.
        </p>
        <TextArea label="Explanation" value={explanation} onChange={setExplanation} max={LIMITS.explanation} required error={errors.explanation} />
        <TextArea label="Guiding question" value={guidingQuestion} onChange={setGuidingQuestion} max={LIMITS.guidingQuestion} error={errors.guidingQuestion} />
        <TextArea label="Practice task" value={practiceTask} onChange={setPracticeTask} max={LIMITS.practiceTask} error={errors.practiceTask} />

        <fieldset className={styles.radioGroup}>
          <legend>Approved resources for this concept (optional, up to {LIMITS.resources})</legend>
          {!resources.ok ? (
            <SectionError message={resources.message} />
          ) : choices.length === 0 ? (
            <p className={styles.fieldHelp}>No approved resources are recorded for this concept, so none can be attached.</p>
          ) : (
            choices.map((resource) => (
              <label key={resource.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={resourceIds.includes(resource.id)}
                  onChange={() => toggle(resource.id)}
                />
                <span>
                  {resource.title} <span className="muted">({resource.kind})</span>
                </span>
              </label>
            ))
          )}
          <FormError message={errors.resourceIds} />
        </fieldset>

        <TextArea label="Note" value={note} onChange={setNote} max={LIMITS.note} error={errors.note} />
        <FormError message={errors.form} />
        <SubmitRow pending={pending} label="Assign support" pendingLabel="Sending…" />
      </fieldset>
      <ActionFeedback outcome={outcome} />
    </form>
  );
}

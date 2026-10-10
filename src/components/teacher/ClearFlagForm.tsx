"use client";
// Clear the attention flag for ONE student and ONE concept. TEACHER-OWNED. Client component.
// Clearing the flag changes only the flag. It does not approve progression, change the learning state,
// reset support cycles or open another automated cycle.
import { useState, type FormEvent } from "react";
import { buildClearFlag, type Target } from "@/lib/teacher/action-inputs";
import { ActionFeedback } from "./ActionFeedback";
import { FormError, SubmitRow, TextArea } from "./FormFields";
import { useActionSubmit } from "./useActionSubmit";
import styles from "./teacher.module.css";

export function ClearFlagForm({ target, flagged }: { target: Target; flagged: boolean }) {
  const { submit, pending, outcome } = useActionSubmit();
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const built = buildClearFlag(target, { note });
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    await submit(built.input);
  }

  return (
    <form className={styles.actionForm} onSubmit={onSubmit} noValidate aria-label={`Clear attention flag for ${target.conceptId}`}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={pending}>
        <legend>Clear attention flag</legend>
        <p className={styles.fieldHelp}>
          Clears only the attention flag. <strong>It does not approve progression</strong>, change the learning state, reset the
          support-cycle count or allow another automated cycle.
          {!flagged && " This concept has no attention flag recorded, so there may be nothing to clear."}
        </p>
        <TextArea label="Note" value={note} onChange={setNote} max={2000} error={errors.note} />
        <FormError message={errors.form} />
        <SubmitRow pending={pending} label="Clear attention flag" pendingLabel="Sending…" />
      </fieldset>
      <ActionFeedback outcome={outcome} />
    </form>
  );
}

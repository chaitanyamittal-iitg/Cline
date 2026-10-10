"use client";
// Add an audit note for ONE student and ONE concept. TEACHER-OWNED. Client component.
// A note is only recorded in the teacher action log by the backend; it changes no learning state.
import { useState, type FormEvent } from "react";
import { buildNote, type Target } from "@/lib/teacher/action-inputs";
import { ActionFeedback } from "./ActionFeedback";
import { FormError, SubmitRow, TextArea } from "./FormFields";
import { useActionSubmit } from "./useActionSubmit";
import styles from "./teacher.module.css";

export function NoteForm({ target }: { target: Target }) {
  const { submit, pending, outcome } = useActionSubmit();
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const built = buildNote(target, { note });
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    await submit(built.input);
  }

  return (
    <form className={styles.actionForm} onSubmit={onSubmit} noValidate aria-label={`Add a note for ${target.conceptId}`}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={pending}>
        <legend>Add an audit note</legend>
        <p className={styles.fieldHelp}>Adds a note to the teacher action record. It changes no learning state.</p>
        <TextArea label="Note" value={note} onChange={setNote} max={2000} required error={errors.note} />
        <FormError message={errors.form} />
        <SubmitRow pending={pending} label="Add note" pendingLabel="Sending…" />
      </fieldset>
      <ActionFeedback outcome={outcome} />
    </form>
  );
}

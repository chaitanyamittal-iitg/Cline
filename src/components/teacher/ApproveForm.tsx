"use client";
// Approve progression for ONE student and ONE concept. TEACHER-OWNED. Client component.
// If the recorded state is not "passed" the teacher must tick an (initially unchecked) override box AND write a note.
// Approving records the teacher's decision to move on; it never changes the original diagnosis.
import { useState, type FormEvent } from "react";
import { buildApproval, type Target } from "@/lib/teacher/action-inputs";
import { stateLabel } from "@/lib/teacher/labels";
import { ActionFeedback } from "./ActionFeedback";
import { Checkbox, FormError, SubmitRow, TextArea } from "./FormFields";
import { useActionSubmit } from "./useActionSubmit";
import styles from "./teacher.module.css";

export function ApproveForm({ target, state, alreadyApproved }: { target: Target; state: string; alreadyApproved: boolean }) {
  const { submit, pending, outcome } = useActionSubmit();
  const [override, setOverride] = useState(false); // always starts unchecked
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const passed = state === "passed";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const built = buildApproval(target, { state, override, note });
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    await submit(built.input);
  }

  return (
    <form className={styles.actionForm} onSubmit={onSubmit} noValidate aria-label={`Approve progression for ${target.conceptId}`}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={pending}>
        <legend>Approve progression</legend>
        <p className={styles.fieldHelp}>
          Records that you approve this student moving on from this concept. It does not change the original AI diagnosis or the
          student&rsquo;s work. Recorded state: <strong>{stateLabel(state)}</strong>.
          {alreadyApproved && " An approval is already recorded; repeating it changes nothing."}
        </p>
        {!passed && (
          <>
            <p className="notice">
              This student has not passed this concept. To approve progression anyway you must tick the override box and write a note
              explaining why. The original diagnosis stays exactly as it is.
            </p>
            <Checkbox
              label="Override: approve progression although this student has not passed"
              checked={override}
              onChange={setOverride}
              error={errors.override}
            />
          </>
        )}
        <TextArea
          label="Note"
          value={note}
          onChange={setNote}
          max={2000}
          required={!passed}
          error={errors.note}
          help={passed ? "Optional for a student who has passed." : "Required: why are you approving progression?"}
        />
        <FormError message={errors.form} />
        <SubmitRow pending={pending} label="Approve progression" pendingLabel="Sending…" />
      </fieldset>
      <ActionFeedback outcome={outcome} />
    </form>
  );
}

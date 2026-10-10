"use client";

// One open-ended question: the student TYPES an answer or adds a PHOTO of handwriting (see PhotoAnswer).
import type { AnswerDraft, AnswerMode } from "@/lib/student/answer-draft";
import { DEMO_AVAILABILITY, PHOTO_UNAVAILABLE_BUTTON, PHOTO_UNAVAILABLE_NOTICE } from "@/lib/student/demo-availability";
import type { PromptQuestion } from "@/lib/student/journey-types";
import { PhotoAnswer, type DraftUpdater } from "./PhotoAnswer";
import styles from "./student.module.css";

export function AnswerField({
  index,
  question,
  attemptId,
  draft,
  update,
  disabled,
}: {
  index: number;
  question: PromptQuestion;
  attemptId: string;
  draft: AnswerDraft;
  update: DraftUpdater;
  disabled: boolean;
}) {
  const inputId = `answer-${question.id}`;
  const photoAvailable = DEMO_AVAILABILITY.photoUpload;
  const setMode = (mode: AnswerMode) => update((d) => ({ ...d, mode }));

  return (
    <fieldset className={styles.question} disabled={disabled}>
      <legend className={styles.questionLegend}>Question {index + 1}</legend>
      <p className={styles.questionPrompt}>{question.prompt}</p>

      <div className={styles.modeRow} role="group" aria-label="How do you want to answer?">
        <button
          type="button"
          className={`${styles.modeBtn} ${draft.mode === "type" ? styles.modeOn : ""}`}
          aria-pressed={draft.mode === "type"}
          onClick={() => setMode("type")}
        >
          Type my answer
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${draft.mode === "photo" && photoAvailable ? styles.modeOn : ""}`}
          aria-pressed={draft.mode === "photo" && photoAvailable}
          disabled={!photoAvailable}
          onClick={() => setMode("photo")}
        >
          {photoAvailable ? "Add a photo" : PHOTO_UNAVAILABLE_BUTTON}
        </button>
      </div>
      {!photoAvailable && (
        <p className={styles.hint} role="note">
          {PHOTO_UNAVAILABLE_NOTICE}
        </p>
      )}

      {draft.mode === "type" || !photoAvailable ? (
        <>
          <label htmlFor={inputId}>Your answer</label>
          <textarea
            id={inputId}
            rows={5}
            maxLength={4000}
            value={draft.typed}
            onChange={(e) => update((d) => ({ ...d, typed: e.target.value }))}
            placeholder="Explain in your own words"
          />
        </>
      ) : (
        <PhotoAnswer inputId={inputId} attemptId={attemptId} questionId={question.id} draft={draft} update={update} />
      )}
    </fieldset>
  );
}

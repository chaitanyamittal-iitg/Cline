"use client";

// The questions of one sitting and the button that sends all answers through POST /api/answers.
// Unsent work stays on screen if the request fails. A second tap while a request is pending is ignored.
import { useState } from "react";
import { SubmitAnswersResponseSchema, type ConceptId, type SubmitAnswersRequest, type SubmitAnswersResponse } from "@/lib/contracts";
import { postJson } from "@/lib/student/api-client";
import { buildAnswer, emptyDraft, isUploading, type AnswerDraft } from "@/lib/student/answer-draft";
import type { YourAnswer } from "@/lib/student/feedback-model";
import type { PromptQuestion } from "@/lib/student/journey-types";
import { AnswerField } from "./AnswerField";
import { usePending } from "./usePending";
import styles from "./student.module.css";

export function AnswerForm({
  conceptId,
  attemptId,
  questions,
  onSubmitted,
}: {
  conceptId: ConceptId;
  attemptId: string;
  questions: PromptQuestion[];
  onSubmitted: (response: SubmitAnswersResponse, yourAnswers: YourAnswer[]) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const sender = usePending();

  const draftFor = (id: string) => drafts[id] ?? emptyDraft();
  const updateFor = (id: string) => (change: (d: AnswerDraft) => AnswerDraft) =>
    setDrafts((current) => ({ ...current, [id]: change(current[id] ?? emptyDraft()) }));

  const built = questions.map((q) => buildAnswer(q.id, draftFor(q.id)));
  const missing = built.filter((a) => a === null).length;
  const uploading = questions.some((q) => isUploading(draftFor(q.id)));
  const ready = missing === 0 && !uploading;

  async function submit() {
    if (!ready) return;
    const answers = built.filter((a): a is NonNullable<typeof a> => a !== null);
    await sender.run(async () => {
      setError(null);
      const body: SubmitAnswersRequest = { conceptId, attemptId, answers };
      const result = await postJson("/api/answers", body, SubmitAnswersResponseSchema);
      if (!result.ok) {
        setError(result.error); // every answer stays exactly as the student left it
        return;
      }
      const yourAnswers: YourAnswer[] = answers.map((a) => ({
        questionId: a.questionId,
        text: a.typedText ?? a.confirmedText ?? "",
        fromPhoto: a.uploadPath !== undefined,
        clarification: null,
      }));
      onSubmitted(result.data, yourAnswers);
    });
  }

  return (
    <div>
      {questions.map((q, i) => (
        <AnswerField key={q.id} index={i} question={q} attemptId={attemptId} draft={draftFor(q.id)} update={updateFor(q.id)} disabled={sender.pending} />
      ))}
      <div className={styles.actions}>
        <button type="button" className={`btn ${styles.primary}`} onClick={submit} disabled={!ready || sender.pending}>
          {sender.pending ? "Sending your answers\u2026" : error ? "Try again" : "Send my answers"}
        </button>
      </div>
      {!ready && !sender.pending && (
        <p className={styles.hint} role="status">
          {uploading
            ? "Please wait while your picture uploads."
            : "Answer every question to send. For a photo, check the text and press \u201CYes, this is what I wrote\u201D."}
        </p>
      )}
      <div aria-live="polite">
        {error && (
          <p className={`error ${styles.inlineStatus}`} role="alert">
            {error} Your answers are still here.
          </p>
        )}
      </div>
    </div>
  );
}

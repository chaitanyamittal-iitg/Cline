"use client";

// One open clarification. The AI could not tell what the student meant, so it asks a short question instead of
// guessing. Replies go to POST /api/answers/follow-up and resume the SAME test. A reply that fails to send stays
// in the box. This is never presented as a wrong answer.
import { useState } from "react";
import { FollowUpResponseSchema, type ConceptId, type FollowUp, type FollowUpRequest, type SubmitAnswersResponse } from "@/lib/contracts";
import { postJson } from "@/lib/student/api-client";
import { usePending } from "./usePending";
import styles from "./student.module.css";

export function FollowUpForm({
  conceptId,
  attemptId,
  followUp,
  promptText,
  onDone,
}: {
  conceptId: ConceptId;
  attemptId: string;
  followUp: FollowUp;
  promptText: string;
  onDone: (response: SubmitAnswersResponse, reply: string) => void;
}) {
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sender = usePending();
  const id = `followup-${followUp.questionId}`;

  async function send() {
    const response = reply.trim();
    if (!response) return;
    await sender.run(async () => {
      setError(null);
      const body: FollowUpRequest = { conceptId, attemptId, questionId: followUp.questionId, response };
      const result = await postJson("/api/answers/follow-up", body, FollowUpResponseSchema);
      if (!result.ok) {
        setError(result.error); // the reply stays in the box
        return;
      }
      onDone(result.data, response);
    });
  }

  return (
    <div className={styles.followUp}>
      <p className={styles.questionLegend}>A quick question about: {promptText}</p>
      <p className={styles.followUpQuestion}>{followUp.question}</p>
      <label htmlFor={id}>Your reply</label>
      <textarea id={id} rows={3} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a sentence or two" disabled={sender.pending} />
      <div className={styles.actions}>
        <button type="button" className={`btn ${styles.primary}`} onClick={send} disabled={sender.pending || reply.trim().length === 0}>
          {sender.pending ? "Sending\u2026" : error ? "Try again" : "Send my reply"}
        </button>
      </div>
      <div aria-live="polite">
        {error && (
          <p className={`error ${styles.inlineStatus}`} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";
// Honest result of one teacher action. TEACHER-OWNED. Client component (it only displays an already-classified outcome).
// "Saved" appears only for outcome.kind === "saved", which classifyResponse() produces only for a valid 2xx
// { ok: true, data } response. Every other kind says plainly that nothing was confirmed saved.
import { describeSaved, type ActionOutcome } from "@/lib/teacher/action-response";
import styles from "./teacher.module.css";

export function ActionFeedback({ outcome }: { outcome: (ActionOutcome & { action: string }) | null }) {
  if (!outcome) return null;

  if (outcome.kind === "saved") {
    const saved = describeSaved(outcome.action, outcome.data);
    return (
      <div className={`${styles.feedback} ${styles.feedbackSaved}`} role="status">
        <p>
          <strong>{saved.headline}</strong>
        </p>
        {saved.details.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    );
  }

  if (outcome.kind === "session") {
    return (
      <div className={`${styles.feedback} ${styles.feedbackError}`} role="alert">
        <p>{outcome.message}</p>
        <p>
          <a className="btn btn-secondary" href="/login">
            Go to sign-in
          </a>
        </p>
      </div>
    );
  }

  const tone = outcome.kind === "not_ready" ? styles.feedbackWarn : styles.feedbackError;
  return (
    <div className={`${styles.feedback} ${tone}`} role="alert">
      <p>{outcome.message}</p>
      {outcome.kind === "rejected" && outcome.code === "not_found" && (
        <p className="muted">
          The student, concept progress or diagnosis may have changed. Reload the page to see the current records.
        </p>
      )}
      {outcome.kind === "rejected" && outcome.code === "forbidden" && (
        <p className="muted">The server did not accept this as a teacher request. Nothing was saved.</p>
      )}
    </div>
  );
}

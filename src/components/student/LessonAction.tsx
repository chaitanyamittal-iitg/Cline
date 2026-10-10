"use client";

// End-of-lesson action. Asks the server (POST /api/progress/advance) to move the student from the lesson to
// the doubt step. The displayed state changes ONLY when the server answers with success and a valid progress
// record; a failed or unavailable server never produces a pretend success.
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdvanceProgressResponseSchema,
  type AdvanceProgressRequest,
  type ConceptId,
  type LearningState,
} from "@/lib/contracts";
import styles from "./student.module.css";

const UNAVAILABLE = "We could not reach the learning service. Please check your connection and try again.";

async function requestAdvance(conceptId: ConceptId): Promise<{ ok: true; state: LearningState } | { ok: false; error: string }> {
  const body: AdvanceProgressRequest = { conceptId, to: "doubts" };
  let response: Response;
  try {
    response = await fetch("/api/progress/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: UNAVAILABLE };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: UNAVAILABLE };
  }

  const envelope = payload as { ok?: unknown; data?: unknown; error?: unknown } | null;
  if (envelope && envelope.ok === true) {
    const parsed = AdvanceProgressResponseSchema.safeParse(envelope.data);
    if (parsed.success && parsed.data.progress.conceptId === conceptId) {
      return { ok: true, state: parsed.data.progress.state };
    }
    return { ok: false, error: "The learning service sent an answer we did not understand. Please try again." };
  }
  if (envelope && envelope.ok === false && typeof envelope.error === "string" && envelope.error.trim()) {
    return { ok: false, error: envelope.error };
  }
  return { ok: false, error: UNAVAILABLE };
}

export function LessonAction({ conceptId, initialState }: { conceptId: ConceptId; initialState: LearningState }) {
  const router = useRouter();
  const [state, setState] = useState<LearningState>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finishLesson() {
    setBusy(true);
    setError(null);
    const result = await requestAdvance(conceptId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState(result.state);
    router.refresh(); // re-read the saved state from the database
  }

  if (state === "lesson") {
    return (
      <section className="card" aria-labelledby="finish-heading">
        <p className={styles.step}>Next step</p>
        <h2 id="finish-heading">Finished the lesson and the reading?</h2>
        <p className="muted">When you are ready, move on to ask any doubts you have.</p>
        <div className={styles.actions}>
          <button type="button" className={`btn ${styles.primary}`} onClick={finishLesson} disabled={busy}>
            {busy ? "Saving\u2026" : error ? "Try again" : "I\u2019ve finished the lesson"}
          </button>
        </div>
        <div aria-live="polite">
          {error && (
            <p className={`error ${styles.inlineStatus}`} role="alert">
              {error} Your place in the lesson is safe.
            </p>
          )}
        </div>
      </section>
    );
  }

  if (state === "doubts") {
    return (
      <section className="card" aria-live="polite">
        <p className={styles.step}>Saved</p>
        <h2>Your lesson is complete</h2>
        <p className="notice">
          The doubts screen is not ready yet, so there is nothing more to do here for now. Your progress has been
          saved and your place will be kept.
        </p>
      </section>
    );
  }

  return null;
}

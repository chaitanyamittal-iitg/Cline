"use client";

// Doubt step. The student may ask as many questions as they like through POST /api/tutor, or skip straight to the
// written test (POST /api/attempts/start). Saved messages come from the database; new replies appear only after the
// server answers with a valid response. An unsent question stays in the box if the request fails.
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AskTutorResponseSchema,
  StartMicrotestResponseSchema,
  type AskTutorRequest,
  type ConceptId,
  type StartMicrotestRequest,
} from "@/lib/contracts";
import { postJson } from "@/lib/student/api-client";
import { DEMO_AVAILABILITY, TUTOR_UNAVAILABLE_BUTTON, TUTOR_UNAVAILABLE_NOTICE } from "@/lib/student/demo-availability";
import { doubtPrompt, SKIP_DOUBTS_LABEL } from "@/lib/student/doubt-text";
import type { TutorMessageView, VisualResourceView } from "@/lib/student/journey-types";
import { ApprovedVisual } from "./ApprovedVisual";
import { SourceBadge } from "./SourceBadge";
import { usePending } from "./usePending";
import styles from "./student.module.css";

const MAX_MESSAGE = 2000;

export function DoubtStep({
  conceptId,
  conceptTitle,
  initialMessages,
  visuals,
}: {
  conceptId: ConceptId;
  conceptTitle: string;
  initialMessages: TutorMessageView[];
  visuals: VisualResourceView[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<TutorMessageView[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [askError, setAskError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const asking = usePending();
  const starting = usePending();
  const busy = asking.pending || starting.pending;
  const tutorAvailable = DEMO_AVAILABILITY.tutor;

  const visualById = new Map(visuals.map((v) => [v.id, v]));

  async function ask() {
    const message = draft.trim();
    if (!tutorAvailable || !message || busy) return;
    await asking.run(async () => {
      setAskError(null);
      const body: AskTutorRequest = { conceptId, message };
      const result = await postJson("/api/tutor", body, AskTutorResponseSchema);
      if (!result.ok) {
        setAskError(result.error); // the question stays in the box so it can be sent again
        return;
      }
      setMessages((current) => [
        ...current,
        { id: `s-${current.length}`, role: "student", content: message, resourceId: null, source: null },
        { id: `t-${current.length}`, role: "tutor", content: result.data.reply, resourceId: result.data.resourceId, source: result.data.source },
      ]);
      setDraft("");
    });
  }

  async function startTest() {
    if (busy) return;
    await starting.run(async () => {
      setStartError(null);
      const body: StartMicrotestRequest = { conceptId };
      const result = await postJson("/api/attempts/start", body, StartMicrotestResponseSchema);
      if (!result.ok) {
        setStartError(result.error);
        return;
      }
      router.refresh(); // re-read the saved state and the test the server created
    });
  }

  return (
    <>
      <section className="card" aria-labelledby="doubts-heading">
        <p className={styles.step}>Step 2</p>
        <h2 id="doubts-heading">{doubtPrompt(conceptTitle)}</h2>
        <p className="muted">You can ask as many questions as you like.</p>

        {messages.length > 0 && (
          <ol className={styles.chat} aria-live="polite" aria-label="Your questions and the tutor's replies">
            {messages.map((m) => {
              const visual = m.resourceId ? visualById.get(m.resourceId) : undefined;
              return (
                <li key={m.id} className={m.role === "student" ? styles.bubbleStudent : styles.bubbleTutor}>
                  <p className={styles.bubbleWho}>
                    {m.role === "student" ? "You asked" : "Tutor"}
                    {m.role === "tutor" && m.source && <SourceBadge source={m.source} />}
                  </p>
                  <p className={styles.bubbleText}>{m.content}</p>
                  {visual && <ApprovedVisual visual={visual} />}
                </li>
              );
            })}
          </ol>
        )}

        {!tutorAvailable && (
          <p className="notice" role="note">
            {TUTOR_UNAVAILABLE_NOTICE}
          </p>
        )}
        <label htmlFor="doubt-input">Your question</label>
        <textarea
          id="doubt-input"
          rows={3}
          maxLength={MAX_MESSAGE}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={tutorAvailable ? "Type your question here" : "Asking the tutor is unavailable for this demo"}
          disabled={asking.pending || !tutorAvailable}
        />
        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={ask}
            disabled={!tutorAvailable || busy || draft.trim().length === 0}
          >
            {!tutorAvailable ? TUTOR_UNAVAILABLE_BUTTON : asking.pending ? "Asking\u2026" : askError ? "Try again" : "Ask the tutor"}
          </button>
        </div>
        <div aria-live="polite">
          {askError && (
            <p className={`error ${styles.inlineStatus}`} role="alert">
              {askError}
            </p>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="start-heading">
        <p className={styles.step}>Next step</p>
        <h2 id="start-heading">No more doubts?</h2>
        <p className="muted">When you are ready, start your short written micro-test. You can skip the doubts and go straight to it.</p>
        <div className={styles.actions}>
          <button type="button" className={`btn ${styles.primary}`} onClick={startTest} disabled={busy}>
            {starting.pending ? "Opening your micro-test\u2026" : startError ? "Try again" : SKIP_DOUBTS_LABEL}
          </button>
        </div>
        <div aria-live="polite">
          {startError && (
            <p className={`error ${styles.inlineStatus}`} role="alert">
              {startError}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

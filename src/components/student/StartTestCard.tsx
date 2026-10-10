"use client";

// Fallback used only when the saved state says "micro-test" but no test has been created yet.
// POST /api/attempts/start is idempotent, so pressing it again returns the same test. Nothing happens on page load.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StartMicrotestResponseSchema, type ConceptId, type StartMicrotestRequest } from "@/lib/contracts";
import { postJson } from "@/lib/student/api-client";
import { usePending } from "./usePending";
import styles from "./student.module.css";

export function StartTestCard({ conceptId }: { conceptId: ConceptId }) {
  const router = useRouter();
  const sender = usePending();
  const [error, setError] = useState<string | null>(null);

  async function start() {
    await sender.run(async () => {
      setError(null);
      const body: StartMicrotestRequest = { conceptId };
      const result = await postJson("/api/attempts/start", body, StartMicrotestResponseSchema);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="card" aria-labelledby="open-test-heading">
      <p className={styles.step}>Your test</p>
      <h2 id="open-test-heading">Your short written test</h2>
      <p className="muted">Open your test to see the questions.</p>
      <div className={styles.actions}>
        <button type="button" className={`btn ${styles.primary}`} onClick={start} disabled={sender.pending}>
          {sender.pending ? "Opening your test\u2026" : error ? "Try again" : "Open my test"}
        </button>
      </div>
      <div aria-live="polite">
        {error && (
          <p className={`error ${styles.inlineStatus}`} role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

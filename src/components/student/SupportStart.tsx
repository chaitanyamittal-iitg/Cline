"use client";

// Offers targeted extra help through POST /api/support. Shown only when the saved state allows it; the server is
// still the one that enforces "at most two automated cycles" and refuses a third. On success the page is re-read so
// the support and the fresh questions shown are the ones the server saved.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StartSupportResponseSchema, type ConceptId, type StartSupportRequest } from "@/lib/contracts";
import { postJson } from "@/lib/student/api-client";
import { usePending } from "./usePending";
import styles from "./student.module.css";

export function SupportStart({ conceptId }: { conceptId: ConceptId }) {
  const router = useRouter();
  const sender = usePending();
  const [error, setError] = useState<string | null>(null);

  async function start() {
    await sender.run(async () => {
      setError(null);
      const body: StartSupportRequest = { conceptId };
      const result = await postJson("/api/support", body, StartSupportResponseSchema);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="card" aria-labelledby="support-heading">
      <p className={styles.step}>Next step</p>
      <h2 id="support-heading">Let&rsquo;s get you some extra help</h2>
      <p className="muted">You will read a short explanation made for you, then try a few fresh questions.</p>
      <div className={styles.actions}>
        <button type="button" className={`btn ${styles.primary}`} onClick={start} disabled={sender.pending}>
          {sender.pending ? "Getting your help ready\u2026" : error ? "Try again" : "Get extra help"}
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

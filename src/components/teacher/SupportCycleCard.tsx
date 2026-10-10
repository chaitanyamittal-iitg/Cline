// One stored support cycle with its real links. TEACHER-OWNED.
//   support_cycles.diagnosis_id            -> the diagnosis the support was created from (nullable)
//   support_cycles.reassessment_attempt_id -> the reassessment attempt (nullable)
// A stored link whose record could not be read is reported as unavailable, never guessed from timing or concept.
import type { LinkedLookup, SupportCycleView } from "@/lib/teacher/view-types";
import { attemptKindLabel, formatTimestamp, outcomeLabel } from "@/lib/teacher/labels";
import { Multiline } from "./Multiline";
import { SourceBadge } from "./SourceBadge";
import styles from "./teacher.module.css";

function linkNote<T>(lookup: LinkedLookup<T>, none: string, unavailable: string): string | null {
  if (lookup.state === "none") return none;
  if (lookup.state === "unavailable") return unavailable;
  return null;
}

export function SupportCycleCard({ view, conceptTitle }: { view: SupportCycleView; conceptTitle: string }) {
  const { cycle, display, triggerDiagnosis, reassessmentAttempt } = view;
  const triggerNote = linkNote(
    triggerDiagnosis,
    "No diagnosis is linked to this support cycle.",
    "A diagnosis is linked, but its record could not be loaded.",
  );
  const reassessmentNote = linkNote(
    reassessmentAttempt,
    "No reassessment attempt is linked to this support cycle yet.",
    "A reassessment attempt is linked, but its record could not be loaded.",
  );
  return (
    <article className="card" aria-label={`Support cycle ${cycle.cycle_number}, ${conceptTitle}`}>
      <div className={styles.cardHeader}>
        <h3>Support cycle {cycle.cycle_number}</h3>
        <SourceBadge source={cycle.ai_source} />
      </div>
      <p className={styles.meta}>
        Concept: {conceptTitle} &middot; Created {formatTimestamp(cycle.created_at)}
      </p>
      <div className={styles.inlineRow}>
        <span className={styles.fieldLabel}>Reassessment outcome</span>
        <span className={styles.pill}>{outcomeLabel(cycle.outcome)}</span>
      </div>

      {display.fields.length === 0 && display.other === null && display.resourceIds.length === 0 && (
        <p className="muted">No support content is stored for this cycle.</p>
      )}
      {display.fields.map((field) => (
        <div key={field.label}>
          <span className={styles.fieldLabel}>{field.label}</span>
          <Multiline text={field.value} />
        </div>
      ))}
      {display.resourceIds.length > 0 && (
        <>
          <span className={styles.fieldLabel}>Approved resources referenced</span>
          <p>{display.resourceIds.join(", ")}</p>
        </>
      )}
      {display.other !== null && (
        <>
          <span className={styles.fieldLabel}>Other stored support content</span>
          <pre className={styles.jsonBlock}>{display.other}</pre>
        </>
      )}

      <span className={styles.fieldLabel}>Created from diagnosis</span>
      {triggerNote ? (
        <p className="muted">{triggerNote}</p>
      ) : triggerDiagnosis.state === "found" ? (
        <>
          <p>{triggerDiagnosis.value.misconception ?? "No misconception recorded on that diagnosis."}</p>
          <p className="muted">Diagnosed {formatTimestamp(triggerDiagnosis.value.created_at)}</p>
        </>
      ) : null}

      <span className={styles.fieldLabel}>Reassessment history</span>
      {reassessmentNote ? (
        <p className="muted">{reassessmentNote}</p>
      ) : reassessmentAttempt.state === "found" ? (
        <p>
          {attemptKindLabel(reassessmentAttempt.value.kind, reassessmentAttempt.value.cycle)} started{" "}
          {formatTimestamp(reassessmentAttempt.value.created_at)}. Its questions and answers appear under
          &ldquo;Attempts and answers&rdquo; above.
        </p>
      ) : null}
    </article>
  );
}

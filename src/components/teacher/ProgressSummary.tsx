// Existing concept progress for one student, ordered by concept position. TEACHER-OWNED.
// Learning state, attention flag and recorded approval are three separate facts. Nothing here marks a concept as
// "current" and nothing infers readiness: that rule is still pending with the lead.
import type { ConceptProgressView, SectionResult } from "@/lib/teacher/types";
import { approvalLabel, attentionLabel, stateLabel } from "@/lib/teacher/labels";
import { SectionError } from "./SectionError";
import styles from "./teacher.module.css";

export function ProgressSummary({ progress }: { progress: SectionResult<ConceptProgressView[]> }) {
  if (!progress.ok) return <SectionError message={progress.message} />;
  if (progress.data.length === 0) {
    return <p className="muted">No concept progress has been recorded for this student yet.</p>;
  }
  return (
    <ul className={styles.conceptList}>
      {progress.data.map((concept) => (
        <li key={concept.conceptId} className={styles.conceptItem}>
          <span className={styles.conceptTitle}>{concept.conceptTitle}</span>{" "}
          <span className="muted">({concept.conceptId})</span>
          <dl className={styles.facts}>
            <dt>Learning state</dt>
            <dd>
              <span className={styles.pill}>{stateLabel(concept.state)}</span>
            </dd>
            <dt>Attention flag</dt>
            <dd>
              <span className={`${styles.pill} ${concept.teacherFlagged ? styles.pillAttention : ""}`}>
                {attentionLabel(concept.teacherFlagged)}
              </span>
            </dd>
            <dt>Moving on</dt>
            <dd>
              <span className={`${styles.pill} ${concept.teacherClearedToNext ? styles.pillApproved : ""}`}>
                {approvalLabel(concept.teacherClearedToNext)}
              </span>
            </dd>
            <dt>Support cycles used</dt>
            <dd>{concept.supportCyclesUsed}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

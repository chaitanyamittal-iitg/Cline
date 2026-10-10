// One stored diagnosis. TEACHER-OWNED. Right/wrong and reasoning quality only: never a number.
import type { DiagnosisRow } from "@/lib/teacher/types";
import { correctnessLabel, formatTimestamp, nextActionLabel, reasoningLabel } from "@/lib/teacher/labels";
import { Multiline } from "./Multiline";
import { SourceBadge } from "./SourceBadge";
import styles from "./teacher.module.css";

export function DiagnosisCard({ diagnosis, conceptTitle }: { diagnosis: DiagnosisRow; conceptTitle?: string }) {
  return (
    <div className={styles.diagnosis}>
      <div className={styles.inlineRow}>
        <strong>Diagnosis</strong>
        <SourceBadge source={diagnosis.ai_source} />
        <span className="muted">{formatTimestamp(diagnosis.created_at)}</span>
      </div>
      {conceptTitle && <p className="muted">Concept: {conceptTitle}</p>}
      <p>{correctnessLabel(diagnosis.is_correct)}</p>
      <p>{reasoningLabel(diagnosis.reasoning_sound)}</p>
      <span className={styles.fieldLabel}>Likely misconception</span>
      {diagnosis.misconception ? <Multiline text={diagnosis.misconception} /> : <p className="muted">None recorded.</p>}
      <span className={styles.fieldLabel}>Evidence</span>
      <Multiline text={diagnosis.evidence} />
      <span className={styles.fieldLabel}>Next action</span>
      <p>{nextActionLabel(diagnosis.next_action)}</p>
      {diagnosis.follow_up_question && (
        <>
          <span className={styles.fieldLabel}>Clarifying question asked</span>
          <Multiline text={diagnosis.follow_up_question} />
          <p className="muted">The student&rsquo;s reply to this question is not stored in a linked record, so it is not shown.</p>
        </>
      )}
    </div>
  );
}

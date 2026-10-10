// Plain-language message for a student's saved learning state. Server component, no data access.
import { describeState } from "@/lib/student/progress";
import type { ConceptProgress } from "@/lib/contracts";
import styles from "./student.module.css";

export function StatePill({ progress }: { progress: ConceptProgress }) {
  const message = describeState(progress);
  const tone = message.tone === "waiting" ? styles.pillWaiting : message.tone === "attention" ? styles.pillAttention : "";
  return <span className={`${styles.pill} ${tone}`}>{message.label}</span>;
}

export function StateNotice({ progress }: { progress: ConceptProgress }) {
  const message = describeState(progress);
  const tone = message.tone === "waiting" ? styles.toneWaiting : message.tone === "attention" ? styles.toneAttention : "";
  return (
    <div className={`${styles.stateNotice} ${tone}`} role="status">
      <h2>{message.headline}</h2>
      <p>{message.detail}</p>
    </div>
  );
}

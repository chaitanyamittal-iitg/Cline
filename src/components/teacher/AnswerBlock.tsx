// One stored answer. TEACHER-OWNED. Original work (typed text, handwritten image) is shown separately from the
// stored AI reading of the handwriting, which is labelled with its recorded source.
import type { ImageResult } from "@/lib/teacher/types";
import type { AnswerView } from "@/lib/teacher/view-types";
import { correctnessLabel, formatTimestamp } from "@/lib/teacher/labels";
import { DiagnosisCard } from "./DiagnosisCard";
import { Multiline } from "./Multiline";
import { SourceBadge } from "./SourceBadge";
import { UploadedWork } from "./UploadedWork";
import styles from "./teacher.module.css";

export function AnswerBlock({
  view,
  images,
  conceptTitles,
}: {
  view: AnswerView;
  images: Record<string, ImageResult>;
  conceptTitles: Record<string, string>;
}) {
  const { answer, diagnoses } = view;
  return (
    <div className={styles.answerBlock}>
      <div className={styles.inlineRow}>
        <strong>Student&rsquo;s answer</strong>
        <span className="muted">{formatTimestamp(answer.created_at)}</span>
        <span className={styles.pill}>{correctnessLabel(answer.is_correct)}</span>
      </div>

      {answer.typed_text !== null && (
        <>
          <span className={styles.fieldLabel}>Original typed answer</span>
          <div className={styles.original}>
            <Multiline text={answer.typed_text} />
          </div>
        </>
      )}

      {answer.upload_path !== null && (
        <>
          <span className={styles.fieldLabel}>Original handwritten work</span>
          <UploadedWork result={images[answer.upload_path]} label="Handwritten answer uploaded by the student" />
        </>
      )}

      {answer.interpreted_text !== null && (
        <>
          <span className={styles.fieldLabel}>AI reading of the handwriting (not the original work)</span>
          <div className={styles.derived}>
            <div className={styles.inlineRow}>
              <SourceBadge source={answer.interpreted_by} />
            </div>
            <Multiline text={answer.interpreted_text} />
          </div>
        </>
      )}

      {diagnoses.length === 0 ? (
        <p className="muted">No diagnosis is linked to this answer.</p>
      ) : (
        diagnoses.map((d) => <DiagnosisCard key={d.id} diagnosis={d} conceptTitle={conceptTitles[d.concept_id]} />)
      )}
    </div>
  );
}

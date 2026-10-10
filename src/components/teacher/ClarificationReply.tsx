// A student's reply to a clarifying question (answers.kind = 'clarification'). TEACHER-OWNED.
// Shown beneath the original answer it clarifies (answers.clarifies_answer_id) and never merged into it:
// the original submission is never overwritten, so the teacher can compare both.
import type { ImageResult } from "@/lib/teacher/types";
import type { AnswerView } from "@/lib/teacher/view-types";
import { formatTimestamp } from "@/lib/teacher/labels";
import { DiagnosisCard } from "./DiagnosisCard";
import { Multiline } from "./Multiline";
import { UploadedWork } from "./UploadedWork";
import styles from "./teacher.module.css";

export function ClarificationReply({
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
    <div className={styles.clarification} role="group" aria-label="Student's reply to a clarifying question">
      <div className={styles.inlineRow}>
        <strong>Clarification reply</strong>
        <span className={styles.pill}>Follow-up, not the original answer</span>
        <span className="muted">{formatTimestamp(answer.created_at)}</span>
      </div>
      {answer.typed_text !== null && (
        <>
          <span className={styles.fieldLabel}>Reply typed by the student</span>
          <div className={styles.original}>
            <Multiline text={answer.typed_text} />
          </div>
        </>
      )}
      {answer.upload_path !== null && (
        <>
          <span className={styles.fieldLabel}>Handwritten reply (the image as submitted)</span>
          <UploadedWork result={images[answer.upload_path]} label="Handwritten clarification uploaded by the student" />
        </>
      )}
      {answer.confirmed_text !== null && (
        <>
          <span className={styles.fieldLabel}>Reply text confirmed by the student</span>
          <div className={styles.confirmed}>
            <Multiline text={answer.confirmed_text} />
          </div>
        </>
      )}
      {diagnoses.map((d) => (
        <DiagnosisCard key={d.id} diagnosis={d} conceptTitle={conceptTitles[d.concept_id]} />
      ))}
    </div>
  );
}

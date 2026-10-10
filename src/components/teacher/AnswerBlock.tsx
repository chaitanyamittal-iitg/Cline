// One stored answer. TEACHER-OWNED. The sources of what the teacher sees are kept visibly separate:
//   1. Original submission: typed text and the handwritten image exactly as submitted.
//   2. Student-confirmed text for the image (answers.confirmed_text): the student's own reading, which is what was
//      diagnosed. It is NOT the AI's reading and NOT the original image.
//   3. AI draft reading (answers.interpreted_text + reading_status): a machine draft, labelled by its recorded source.
//   4. Clarification replies (answers.kind = 'clarification'): later replies, shown beneath the original, never merged.
import type { ImageResult } from "@/lib/teacher/types";
import type { AnswerView } from "@/lib/teacher/view-types";
import { correctnessLabel, formatTimestamp, readingStatusLabel } from "@/lib/teacher/labels";
import { ClarificationReply } from "./ClarificationReply";
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
  const { answer, diagnoses, clarifications } = view;
  const uploadPath = answer.upload_path;
  return (
    <div className={styles.answerBlock}>
      <div className={styles.inlineRow}>
        <strong>Student&rsquo;s original submission</strong>
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

      {uploadPath !== null && (
        <>
          <span className={styles.fieldLabel}>Original handwritten work (the image as submitted)</span>
          <UploadedWork result={images[uploadPath]} label="Handwritten answer uploaded by the student" />

          <span className={styles.fieldLabel}>Text the student confirmed for this image</span>
          {answer.confirmed_text !== null ? (
            <div className={styles.confirmed}>
              <Multiline text={answer.confirmed_text} />
              <p className={styles.fieldHelp}>
                The student&rsquo;s own reading of their handwriting. This is the text that was assessed. It is not the AI&rsquo;s
                reading and not the original image.
              </p>
            </div>
          ) : (
            <p className="muted">
              No student-confirmed text is stored for this image. It may have been submitted before confirmation was required.
            </p>
          )}

          <span className={styles.fieldLabel}>AI draft reading of the handwriting (a machine draft, not the student&rsquo;s words)</span>
          <div className={styles.derived}>
            <div className={styles.inlineRow}>
              <SourceBadge source={answer.interpreted_by} />
              <span className={styles.pill}>{readingStatusLabel(answer.reading_status)}</span>
            </div>
            {answer.interpreted_text !== null ? (
              <Multiline text={answer.interpreted_text} />
            ) : (
              <p className="muted">No AI transcription is stored for this image.</p>
            )}
          </div>
        </>
      )}

      {uploadPath === null && answer.interpreted_text !== null && (
        <>
          <span className={styles.fieldLabel}>Stored AI reading (no image is attached to this answer)</span>
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

      {clarifications.length > 0 && (
        <div>
          <span className={styles.fieldLabel}>Clarification replies to this answer</span>
          {clarifications.map((c) => (
            <ClarificationReply key={c.answer.id} view={c} images={images} conceptTitles={conceptTitles} />
          ))}
        </div>
      )}
    </div>
  );
}

// One stored attempt: an initial written micro-test or a reassessment, distinguished by attempts.kind. TEACHER-OWNED.
import type { ImageResult } from "@/lib/teacher/types";
import type { AttemptView } from "@/lib/teacher/view-types";
import { attemptKindLabel, formatTimestamp } from "@/lib/teacher/labels";
import { AnswerBlock } from "./AnswerBlock";
import { Multiline } from "./Multiline";
import { SourceBadge } from "./SourceBadge";
import styles from "./teacher.module.css";

export function AttemptCard({
  view,
  images,
  conceptTitles,
  promptsLoaded,
}: {
  view: AttemptView;
  images: Record<string, ImageResult>;
  conceptTitles: Record<string, string>;
  promptsLoaded: boolean;
}) {
  const { attempt, items, supportCycle } = view;
  const concept = conceptTitles[attempt.concept_id] ?? attempt.concept_id;
  return (
    <article className="card" aria-label={`${attemptKindLabel(attempt.kind, attempt.cycle)}, ${concept}`}>
      <div className={styles.cardHeader}>
        <h3>{attemptKindLabel(attempt.kind, attempt.cycle)}</h3>
        {attempt.kind === "reassessment" && attempt.ai_source !== null && <SourceBadge source={attempt.ai_source} />}
      </div>
      <p className={styles.meta}>
        Concept: {concept} &middot; Started {formatTimestamp(attempt.created_at)}
        {supportCycle && <> &middot; Linked to support cycle {supportCycle.cycle_number}</>}
      </p>
      {attempt.kind === "reassessment" && attempt.ai_source !== null && (
        <p className={styles.sectionNote}>The questions in a reassessment were generated; the badge shows the recorded source.</p>
      )}

      {items.length === 0 ? (
        <p className="muted">This attempt has no stored questions and no answers.</p>
      ) : (
        items.map((item) => (
          <section key={item.questionId} className={styles.item} aria-label={`Question ${item.questionId}`}>
            <span className={styles.fieldLabel}>Question</span>
            {item.prompt !== null ? (
              <div className={styles.quote}>
                <Multiline text={item.prompt} />
              </div>
            ) : (
              <p className="muted">
                {promptsLoaded
                  ? `The text of question ${item.questionId} was not found.`
                  : `The text of question ${item.questionId} could not be loaded.`}
              </p>
            )}
            {item.answers.length === 0 ? (
              <p className="muted">No answer has been recorded for this question.</p>
            ) : (
              item.answers.map((a) => (
                <AnswerBlock key={a.answer.id} view={a} images={images} conceptTitles={conceptTitles} />
              ))
            )}
          </section>
        ))
      )}
    </article>
  );
}

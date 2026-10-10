// The targeted support the server saved for this cycle, shown BEFORE the fresh reassessment questions.
// It is AI output, so it carries the MOCK AI / Live AI label. Pictures come only from approved resources.
import type { SupportPlan } from "@/lib/contracts";
import type { TeacherSupportView, VisualResourceView } from "@/lib/student/journey-types";
import { ApprovedVisual } from "./ApprovedVisual";
import { SourceBadge } from "./SourceBadge";
import styles from "./student.module.css";

export function SupportPlanCard({ support, visuals }: { support: SupportPlan; visuals: VisualResourceView[] }) {
  const byId = new Map(visuals.map((v) => [v.id, v]));
  const shown = support.resourceIds.flatMap((id) => {
    const visual = byId.get(id);
    return visual ? [visual] : [];
  });
  return (
    <section className="card" aria-labelledby="support-plan-heading">
      <p className={styles.step}>Extra help {support.cycleNumber === 1 ? "" : "(second time)"}</p>
      <h2 id="support-plan-heading">Let&rsquo;s work on this idea together</h2>
      <p>
        <SourceBadge source={support.source} prefix="Help written by" />
      </p>
      <p className={styles.supportLead}>{support.explanation}</p>
      <div className={styles.supportBlock}>
        <h3>Think about this</h3>
        <p>{support.guidingQuestion}</p>
      </div>
      <div className={styles.supportBlock}>
        <h3>Try this</h3>
        <p>{support.practiceTask}</p>
      </div>
      {shown.map((v) => (
        <ApprovedVisual key={v.id} visual={v} />
      ))}
    </section>
  );
}

export function TeacherSupportCard({ items, visuals }: { items: TeacherSupportView[]; visuals: VisualResourceView[] }) {
  if (items.length === 0) return null;
  const byId = new Map(visuals.map((v) => [v.id, v]));
  return (
    <>
      {items.map(({ id, content }) => (
        <section key={id} className="card" aria-label="Help from your teacher">
          <p className={styles.step}>From your teacher</p>
          <h2>Help from your teacher</h2>
          <p className={styles.supportLead}>{content.explanation}</p>
          {content.guidingQuestion && (
            <div className={styles.supportBlock}>
              <h3>Think about this</h3>
              <p>{content.guidingQuestion}</p>
            </div>
          )}
          {content.practiceTask && (
            <div className={styles.supportBlock}>
              <h3>Try this</h3>
              <p>{content.practiceTask}</p>
            </div>
          )}
          {content.resourceIds.flatMap((rid) => {
            const v = byId.get(rid);
            return v ? [<ApprovedVisual key={rid} visual={v} />] : [];
          })}
        </section>
      ))}
    </>
  );
}

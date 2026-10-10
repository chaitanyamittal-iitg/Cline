// Diagnoses with no verified link to a shown answer. TEACHER-OWNED.
// Shown separately at concept level (diagnoses.concept_id). They are never paired with an answer by recency.
import type { SectionResult } from "@/lib/teacher/types";
import type { UnlinkedDiagnosis, UnlinkedReason } from "@/lib/teacher/view-types";
import { DiagnosisCard } from "./DiagnosisCard";
import { SectionError } from "./SectionError";
import styles from "./teacher.module.css";

const REASONS: Record<UnlinkedReason, string> = {
  no_answer_link: "This diagnosis is not linked to a specific answer (for example, it came from homework).",
  answer_not_found: "This diagnosis points to an answer that could not be found among this student's answers.",
  answers_unavailable: "Answers could not be loaded, so this diagnosis cannot be matched to one.",
};

export function UnlinkedDiagnoses({
  result,
  conceptTitles,
}: {
  result: SectionResult<UnlinkedDiagnosis[]>;
  conceptTitles: Record<string, string>;
}) {
  if (!result.ok) return <SectionError message={result.message} />;
  if (result.data.length === 0) return null;
  return (
    <section aria-labelledby="unlinked-heading">
      <h2 id="unlinked-heading">Diagnoses without an answer link</h2>
      <p className={styles.sectionNote}>
        These are shown at concept level only. Linking them to an answer, attempt or question would be a guess, so it is not done.
      </p>
      {result.data.map(({ diagnosis, reason }) => (
        <article className="card" key={diagnosis.id}>
          <p className="muted">{REASONS[reason]}</p>
          <DiagnosisCard diagnosis={diagnosis} conceptTitle={conceptTitles[diagnosis.concept_id] ?? diagnosis.concept_id} />
        </article>
      ))}
    </section>
  );
}

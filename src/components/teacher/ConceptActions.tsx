// Action controls for ONE recorded concept of ONE student. TEACHER-OWNED.
// Every action is explicitly scoped to the selected student and this concept. No concept is chosen as "current".
// `savingReady` is read on the server (see lib/teacher/readiness.ts) and passed down as a plain boolean; no client
// component imports the backend module. While it is false a visible notice says saving is unavailable, but the forms
// stay connected to the real route so the real answer (HTTP 501 today) is what the teacher sees.
import { stateLabel } from "@/lib/teacher/labels";
import type { ConceptId } from "@/lib/contracts";
import type { DiagnosisOption, ResourceOption } from "@/lib/teacher/options";
import type { ConceptProgressView, SectionResult } from "@/lib/teacher/types";
import { ApproveForm } from "./ApproveForm";
import { AssignSupportForm } from "./AssignSupportForm";
import { ClearFlagForm } from "./ClearFlagForm";
import { NoteForm } from "./NoteForm";
import { OverrideForm } from "./OverrideForm";
import styles from "./teacher.module.css";

export function ConceptActions({
  studentId,
  concept,
  diagnosisOptions,
  resourceOptions,
  savingReady,
}: {
  studentId: string;
  concept: ConceptProgressView;
  diagnosisOptions: SectionResult<DiagnosisOption[]>;
  resourceOptions: SectionResult<ResourceOption[]>;
  savingReady: boolean;
}) {
  // The recorded concept id comes from a stored progress row; the contract only accepts C1..C4.
  const target = { studentId, conceptId: concept.conceptId as ConceptId };
  return (
    <section className="card" aria-labelledby={`actions-${concept.conceptId}`}>
      <h3 id={`actions-${concept.conceptId}`}>
        Teacher actions: {concept.conceptTitle} <span className="muted">({concept.conceptId})</span>
      </h3>
      <p className={styles.meta}>
        Recorded state: {stateLabel(concept.state)}. These actions apply only to this student and this concept.
      </p>
      {!savingReady && (
        <p className="notice" role="status">
          Saving teacher actions is not available yet. You can fill in and submit a form, but the server will say it cannot save
          it, and your changes will not be saved.
        </p>
      )}
      <div className={styles.actionPanel}>
        <ApproveForm target={target} state={concept.state} alreadyApproved={concept.teacherClearedToNext} />
        <ClearFlagForm target={target} flagged={concept.teacherFlagged} />
        <NoteForm target={target} />
        <AssignSupportForm target={target} resources={resourceOptions} />
        <OverrideForm target={target} diagnoses={diagnosisOptions} />
      </div>
    </section>
  );
}

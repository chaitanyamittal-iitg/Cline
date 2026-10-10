// Action controls for ONE recorded concept of ONE student. TEACHER-OWNED.
// Every action is explicitly scoped to the selected student and this concept. No concept is chosen as "current".
// `savingReady` is read on the server (see lib/teacher/readiness.ts) and passed down as a plain boolean; no client
// component imports the backend module. While it is false a visible notice says saving is unavailable, but the forms
// stay connected to the real route so the real answer (HTTP 501 today) is what the teacher sees.
import { UNAVAILABLE_NOTICE, type ActionAvailability } from "@/lib/teacher/availability";
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

/** Honest notice placed directly above a form whose action the backend cannot save yet. */
function Unavailable({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="notice" role="status">
      {UNAVAILABLE_NOTICE}
    </p>
  );
}

export function ConceptActions({
  studentId,
  concept,
  diagnosisOptions,
  resourceOptions,
  availability,
}: {
  studentId: string;
  concept: ConceptProgressView;
  diagnosisOptions: SectionResult<DiagnosisOption[]>;
  resourceOptions: SectionResult<ResourceOption[]>;
  availability: ActionAvailability;
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
      <div className={styles.actionPanel}>
        <ApproveForm target={target} state={concept.state} alreadyApproved={concept.teacherClearedToNext} />
        <NoteForm target={target} />
        <Unavailable show={!availability.clear_flag} />
        <ClearFlagForm target={target} flagged={concept.teacherFlagged} />
        <Unavailable show={!availability.assign_support} />
        <AssignSupportForm target={target} resources={resourceOptions} />
        <Unavailable show={!availability.override_diagnosis} />
        <OverrideForm target={target} diagnoses={diagnosisOptions} />
      </div>
    </section>
  );
}

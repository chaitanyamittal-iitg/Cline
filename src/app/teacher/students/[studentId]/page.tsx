// Student detail. Owned by the Teacher dashboard (branch feat/teacher).
// Reads with the teacher's own session (RLS applies). The action forms below call POST /api/teacher/action; this page
// itself writes nothing. Which actions can save is read from the backend on the server and passed down as plain data.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { loadStudentDetail } from "@/lib/teacher/detail";
import { teacherActionAvailability } from "@/lib/teacher/readiness";
import { AttemptCard } from "@/components/teacher/AttemptCard";
import { ClarificationReply } from "@/components/teacher/ClarificationReply";
import { ConceptActions } from "@/components/teacher/ConceptActions";
import { ProgressSummary } from "@/components/teacher/ProgressSummary";
import { ReloadButton } from "@/components/teacher/ReloadButton";
import { SectionError } from "@/components/teacher/SectionError";
import { SupportCycleCard } from "@/components/teacher/SupportCycleCard";
import { UnlinkedDiagnoses } from "@/components/teacher/UnlinkedDiagnoses";
import styles from "@/components/teacher/teacher.module.css";

// Authenticated data and short-lived signed image links: never prerendered, cached or shared.
export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  // Auth first; redirect() is thrown by requireTeacher() and is never caught here.
  await requireTeacher();
  const { studentId } = await params;
  const result = await loadStudentDetail(studentId);

  if (result.status === "not_found") notFound();
  if (result.status === "error") {
    return (
      <div className={styles.stack}>
        <Link className={styles.backLink} href="/teacher">&larr; Back to class dashboard</Link>
        <div className="card">
          <SectionError message={result.message} />
          <ReloadButton label="Try again" />
        </div>
      </div>
    );
  }

  const { student, progress, conceptTitles, work, unlinkedDiagnoses, support, images, diagnosisOptions, resourceOptions } =
    result.detail;
  const titleOf = (conceptId: string) => conceptTitles[conceptId] ?? conceptId;
  const availability = teacherActionAvailability();

  return (
    <div className={styles.stack}>
      <Link className={styles.backLink} href="/teacher">&larr; Back to class dashboard</Link>

      <section aria-labelledby="student-heading" className="card">
        <h1 id="student-heading">{student.displayName}</h1>
        <p className={styles.meta}>{student.classLabel ?? "Class not recorded"}</p>
        <h2>Progress by concept</h2>
        <ProgressSummary progress={progress} />
      </section>

      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading">Teacher actions</h2>
        <p className={styles.sectionNote}>
          One set of actions per recorded concept. Nothing is chosen as the &ldquo;current&rdquo; concept: pick the concept the
          action is about. Diagnoses and student work shown on this page are never edited by these actions.
        </p>
        {!progress.ok ? (
          <SectionError message={progress.message} />
        ) : progress.data.length === 0 ? (
          <p className="card muted">
            No concept progress is recorded for this student, so there is no concept to act on.
          </p>
        ) : (
          progress.data.map((concept) => (
            <ConceptActions
              key={concept.conceptId}
              studentId={student.id}
              concept={concept}
              diagnosisOptions={diagnosisOptions}
              resourceOptions={resourceOptions}
              availability={availability}
            />
          ))
        )}
      </section>

      <section aria-labelledby="work-heading">
        <div className={styles.cardHeader}>
          <h2 id="work-heading">Attempts and answers</h2>
          <ReloadButton label="Reload (fresh image links)" />
        </div>
        <p className={styles.sectionNote}>
          For each answer the original submission comes first, then the text the student confirmed for a handwritten image, then
          the AI&rsquo;s draft reading, then any clarification replies. Stored AI readings and diagnoses are labelled with their
          recorded source. Nothing here is scored.
        </p>
        {!work.ok ? (
          <SectionError message={work.message} />
        ) : (
          <>
            {!work.data.diagnosesLoaded && (
              <SectionError message="Diagnoses could not be loaded, so answers are shown without them." />
            )}
            {!work.data.questionPromptsLoaded && (
              <SectionError message="Some question texts could not be loaded." />
            )}
            {work.data.attempts.length === 0 && work.data.orphanAnswers.length === 0 ? (
              <p className="card muted">No attempts have been recorded for this student yet.</p>
            ) : (
              work.data.attempts.map((attempt) => (
                <AttemptCard
                  key={attempt.attempt.id}
                  view={attempt}
                  images={images}
                  conceptTitles={conceptTitles}
                  promptsLoaded={work.data.questionPromptsLoaded}
                />
              ))
            )}
            {work.data.unlinkedClarifications.length > 0 && (
              <div className="card">
                <h3>Clarification replies without a found original</h3>
                <p className={styles.sectionNote}>
                  These replies name an original answer that could not be found among this student&rsquo;s answers, so they are not
                  attached to any question. Pairing them by time or concept would be a guess, so it is not done.
                </p>
                {work.data.unlinkedClarifications.map((c) => (
                  <ClarificationReply key={c.answer.id} view={c} images={images} conceptTitles={conceptTitles} />
                ))}
              </div>
            )}
            {work.data.orphanAnswers.length > 0 && (
              <p className="notice">
                {work.data.orphanAnswers.length} answer(s) belong to an attempt that is not listed above, so they are not shown
                under any attempt.
              </p>
            )}
          </>
        )}
      </section>

      <UnlinkedDiagnoses result={unlinkedDiagnoses} conceptTitles={conceptTitles} />

      <section aria-labelledby="support-heading">
        <h2 id="support-heading">Support cycles</h2>
        {!support.ok ? (
          <SectionError message={support.message} />
        ) : support.data.length === 0 ? (
          <p className="card muted">No support cycles have been recorded for this student.</p>
        ) : (
          support.data.map((view) => (
            <SupportCycleCard key={view.cycle.id} view={view} conceptTitle={titleOf(view.cycle.concept_id)} />
          ))
        )}
      </section>
    </div>
  );
}

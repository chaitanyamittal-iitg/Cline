// Concept page. Owned by the Student flow (feat/student).
// Shows ONE concept, only when the signed-in student already has a saved progress row for it. Editing the URL to a
// concept the student has not been given shows "not found", and none of that concept's content is requested.
// The step shown follows the SAVED state: lesson, doubts, written test, feedback, support, reassessment, outcome.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { ConceptIdSchema } from "@/lib/contracts";
import { getJourneyData } from "@/lib/student/journey-queries";
import { getLessonView } from "@/lib/student/queries";
import { describeState } from "@/lib/student/progress";
import { DoubtStep } from "@/components/student/DoubtStep";
import { LessonAction } from "@/components/student/LessonAction";
import { LessonReading } from "@/components/student/LessonReading";
import { LessonVideo } from "@/components/student/LessonVideo";
import { LoadError } from "@/components/student/LoadError";
import { SittingStep } from "@/components/student/SittingStep";
import { StateNotice, StatePill } from "@/components/student/StateNotice";
import styles from "@/components/student/student.module.css";

export default async function ConceptPage({ params }: { params: Promise<{ concept: string }> }) {
  const user = await requireStudent();
  const { concept: rawConcept } = await params;

  const parsed = ConceptIdSchema.safeParse(rawConcept);
  if (!parsed.success) notFound();
  const conceptId = parsed.data;
  const retryHref = `/student/${conceptId}`;

  const lessonResult = await getLessonView(user.id, conceptId);
  if (!lessonResult.ok) return <LoadError message={lessonResult.error} retryHref={retryHref} />;
  if (!lessonResult.data) notFound();

  const { concept, progress, videos, readings } = lessonResult.data;
  const state = progress.state;
  const message = describeState(progress);
  const inLesson = state === "lesson";
  const hasContent = videos.length > 0 || readings.length > 0;

  // Doubts, tests, support and feedback are read only once the student is past the lesson.
  let journey = null;
  if (!inLesson) {
    const journeyResult = await getJourneyData(user.id, conceptId);
    if (!journeyResult.ok) return <LoadError message={journeyResult.error} retryHref={retryHref} />;
    if (!journeyResult.data) notFound();
    journey = journeyResult.data;
  }

  const lessonMaterial = (
    <>
      {videos.map((video) => (
        <LessonVideo key={video.id} video={video} />
      ))}
      {readings.map((reading) => (
        <LessonReading key={reading.id} reading={reading} />
      ))}
      {!hasContent && (
        <section className="card">
          <p className="notice">No lesson material has been approved for this concept yet. Please ask your teacher.</p>
        </section>
      )}
    </>
  );

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/student">
        &larr; My learning
      </Link>

      <section className="card">
        <p className={styles.eyebrow}>{inLesson ? "Lesson" : "Your learning"}</p>
        <h1>{concept.title}</h1>
        <p className={styles.objective}>{concept.objective}</p>
        <div className={styles.statusRow}>
          <StatePill progress={progress} />
        </div>
        {inLesson ? null : state === "passed" || state === "teacher_flagged" || progress.teacherFlagged ? (
          <StateNotice progress={progress} />
        ) : (
          <p className="muted">{message.detail}</p>
        )}
      </section>

      {inLesson && (
        <>
          {lessonMaterial}
          <LessonAction conceptId={conceptId} initialState={state} />
        </>
      )}

      {journey && state === "doubts" && (
        <>
          <DoubtStep key={`doubts-${journey.messages.length}`} conceptId={conceptId} initialMessages={journey.messages} visuals={journey.visuals} />
          <details className={styles.lessonAgain}>
            <summary>Read the lesson again</summary>
            {lessonMaterial}
          </details>
        </>
      )}

      {journey && state !== "doubts" && (
        <>
          <SittingStep
            key={`${journey.sitting?.attemptId ?? "none"}-${state}-${progress.supportCyclesUsed}-${journey.sitting?.feedback?.attemptOutcome ?? "open"}`}
            conceptId={conceptId}
            initialProgress={progress}
            sitting={journey.sitting}
            support={journey.support}
            supportUnreadable={journey.supportUnreadable}
            teacherSupport={journey.teacherSupport}
            visuals={journey.visuals}
          />
          <details className={styles.lessonAgain}>
            <summary>Read the lesson again</summary>
            {lessonMaterial}
          </details>
        </>
      )}
    </div>
  );
}

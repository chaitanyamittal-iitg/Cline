// Concept lesson page. Owned by the Student flow (feat/student).
// Shows the approved recorded lesson and reading for ONE concept, and only when the signed-in student already has
// a saved progress row for it. Editing the URL to a concept the student has not been given shows "not found",
// and none of that concept's content is requested from the database.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { ConceptIdSchema } from "@/lib/contracts";
import { getLessonView } from "@/lib/student/queries";
import { describeState } from "@/lib/student/progress";
import { LessonAction } from "@/components/student/LessonAction";
import { LessonReading } from "@/components/student/LessonReading";
import { LessonVideo } from "@/components/student/LessonVideo";
import { LoadError } from "@/components/student/LoadError";
import { StateNotice, StatePill } from "@/components/student/StateNotice";
import styles from "@/components/student/student.module.css";

export default async function ConceptLessonPage({ params }: { params: Promise<{ concept: string }> }) {
  const user = await requireStudent();
  const { concept: rawConcept } = await params;

  const parsed = ConceptIdSchema.safeParse(rawConcept);
  if (!parsed.success) notFound();
  const conceptId = parsed.data;

  const result = await getLessonView(user.id, conceptId);
  if (!result.ok) {
    return <LoadError message={result.error} retryHref={`/student/${conceptId}`} />;
  }
  if (!result.data) notFound();

  const { concept, progress, videos, readings } = result.data;
  const message = describeState(progress);
  const state = progress.state;
  const onLessonOrDoubts = state === "lesson" || state === "doubts";
  const waitingOrFlagged = !message.canContinue;
  const hasContent = videos.length > 0 || readings.length > 0;

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/student">
        &larr; My learning
      </Link>

      <section className="card">
        <p className={styles.eyebrow}>Lesson</p>
        <h1>{concept.title}</h1>
        <p className={styles.objective}>{concept.objective}</p>
        <div className={styles.statusRow}>
          <StatePill progress={progress} />
        </div>
        {waitingOrFlagged && <StateNotice progress={progress} />}
        {!onLessonOrDoubts && !waitingOrFlagged && (
          <p className="notice" role="status">
            The next screen for this step is not ready yet, so you cannot continue from here right now. Your progress
            is saved and your place will be kept. You can read the lesson again below.
          </p>
        )}
      </section>

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

      {onLessonOrDoubts && <LessonAction conceptId={conceptId} initialState={state} />}
    </div>
  );
}

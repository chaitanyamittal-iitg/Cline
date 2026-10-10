// Student dashboard. Owned by the Student flow (feat/student).
// Shows the signed-in student's real, saved progress. It never creates progress rows and never unlocks a
// concept from a right answer or from anything in the browser: only the database state decides.
import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { getDashboardData } from "@/lib/student/queries";
import { describeState, journeyStatus, pickCurrent } from "@/lib/student/progress";
import { LoadError } from "@/components/student/LoadError";
import { StateNotice, StatePill } from "@/components/student/StateNotice";
import styles from "@/components/student/student.module.css";

export default async function StudentHome() {
  const user = await requireStudent();
  const result = await getDashboardData(user.id);

  if (!result.ok) {
    return <LoadError message={result.error} retryHref="/student" />;
  }

  const { concepts, progress } = result.data;
  const current = pickCurrent(concepts, progress);

  if (!current) {
    return (
      <div className={styles.page}>
        <section className="card">
          <h1>My learning</h1>
          <p className="notice">
            Your learning has not been set up yet, so there is nothing to open right now. Please ask your teacher to
            get you started, then come back to this page.
          </p>
        </section>
      </div>
    );
  }

  const { concept, progress: currentProgress } = current;
  const href = `/student/${concept.id}`;
  const canContinue = describeState(currentProgress).canContinue;

  // Only concepts the student already has a saved progress row for are listed or linked.
  const progressById = new Map(progress.map((p) => [p.conceptId, p]));
  const available = concepts.filter((c) => progressById.has(c.id));

  return (
    <div className={styles.page}>
      <section className="card" aria-labelledby="current-heading">
        <p className={styles.eyebrow}>Hello, {user.displayName}</p>
        <h1 id="current-heading">{concept.title}</h1>
        <p className={styles.objective}>{concept.objective}</p>
        <div className={styles.statusRow}>
          <StatePill progress={currentProgress} />
        </div>
        <StateNotice progress={currentProgress} />
        <div className={styles.actions}>
          {canContinue ? (
            <Link className={`btn ${styles.primary}`} href={href}>
              Continue learning
            </Link>
          ) : (
            <Link className={`btn btn-secondary ${styles.primary}`} href={href}>
              Read the lesson again
            </Link>
          )}
        </div>
      </section>

      {available.length > 1 && (
        <section className="card" aria-labelledby="journey-heading">
          <h2 id="journey-heading">Your concepts</h2>
          <ul className={styles.journey}>
            {available.map((c) => {
              const p = progressById.get(c.id)!;
              const isCurrent = c.id === concept.id;
              return (
                <li key={c.id}>
                  <Link className={`${styles.journeyItem} ${isCurrent ? styles.journeyCurrent : ""}`} href={`/student/${c.id}`}>
                    <span className={styles.journeyTitle}>{c.title}</span>
                    <span className={styles.journeyStatus}>{journeyStatus(p, isCurrent)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// Teacher class list (read-only). Owned by the Teacher dashboard (branch feat/teacher).
// Reads with the teacher's own session (RLS applies). No actions, scores, rankings or "current concept" rule yet.
import { Suspense } from "react";
import { requireTeacher } from "@/lib/auth";
import { loadStudentList } from "@/lib/teacher/list";
import { ReloadButton } from "@/components/teacher/ReloadButton";
import { SectionError } from "@/components/teacher/SectionError";
import { StudentCard } from "@/components/teacher/StudentCard";
import styles from "@/components/teacher/teacher.module.css";

// Per-teacher, per-request data: never prerendered or shared.
export const dynamic = "force-dynamic";

async function StudentList() {
  const result = await loadStudentList();

  if (!result.ok) {
    return (
      <div className="card">
        <SectionError message={result.message} />
        <ReloadButton label="Try again" />
      </div>
    );
  }
  if (result.students.length === 0) {
    return (
      <p className="card muted">
        No student accounts are visible to you. This is shown only because the list loaded successfully and was empty.
      </p>
    );
  }
  return (
    <>
      {!result.conceptTitlesAvailable && (
        <SectionError message="Concept titles could not be loaded, so concept ids are shown instead." />
      )}
      <div className={styles.studentGrid}>
        {result.students.map((entry) => (
          <StudentCard key={entry.student.id} entry={entry} />
        ))}
      </div>
    </>
  );
}

export default async function TeacherHome() {
  // The layout also checks, but a page must not rely on that. redirect() is thrown, never caught here.
  await requireTeacher();
  return (
    <div className={styles.stack}>
      <section aria-labelledby="class-heading">
        <h1 id="class-heading">Class dashboard</h1>
        <p className="muted">
          Each student&rsquo;s recorded progress for every concept. Learning state, attention flag and moving-on approval are
          shown separately as stored. Diagnoses and support shown on student pages carry a label for their recorded AI source.
        </p>
      </section>
      <Suspense fallback={<p className={`card ${styles.skeleton}`} role="status">Loading students&hellip;</p>}>
        <StudentList />
      </Suspense>
    </div>
  );
}

// One student on the class list. TEACHER-OWNED. Read-only; links to the detail page.
// Shows every progress row grouped by concept. It does not pick a "current" concept (that rule is pending).
import Link from "next/link";
import type { StudentListEntry } from "@/lib/teacher/list";
import { ProgressSummary } from "./ProgressSummary";
import styles from "./teacher.module.css";

export function StudentCard({ entry }: { entry: StudentListEntry }) {
  const { student, progress } = entry;
  const headingId = `student-${student.id}`;
  return (
    <article className="card" aria-labelledby={headingId}>
      <div className={styles.cardHeader}>
        <h2 id={headingId}>{student.displayName}</h2>
      </div>
      <p className={styles.meta}>{student.classLabel ?? "Class not recorded"}</p>
      <ProgressSummary progress={progress} />
      <div className={styles.cardFooter}>
        <Link className="btn" href={`/teacher/students/${student.id}`} aria-label={`View ${student.displayName}'s work`}>
          View student work
        </Link>
      </div>
    </article>
  );
}

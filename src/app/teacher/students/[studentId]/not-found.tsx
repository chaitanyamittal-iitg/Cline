// Shown for a malformed id, a missing profile, a profile hidden by RLS, or a profile that is not a student.
// The page deliberately does not say which. Owned by the Teacher dashboard.
import Link from "next/link";
import styles from "@/components/teacher/teacher.module.css";

export default function StudentNotFound() {
  return (
    <section className="card" aria-labelledby="nf-heading">
      <h1 id="nf-heading">Student not found</h1>
      <p className="muted">There is no student with this link, or you do not have access to them.</p>
      <Link className={`btn ${styles.cardFooter}`} href="/teacher">
        Back to class dashboard
      </Link>
    </section>
  );
}

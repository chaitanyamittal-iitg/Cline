// Shows one approved reading exactly as stored. Text is rendered as plain text (React escapes it).
import type { LessonResource } from "@/lib/student/queries";
import styles from "./student.module.css";

export function LessonReading({ reading }: { reading: LessonResource }) {
  const paragraphs = (reading.body ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <section className={`card ${styles.reading}`} aria-labelledby={`reading-${reading.id}`}>
      <p className={styles.step}>Read</p>
      <h2 id={`reading-${reading.id}`}>{reading.title}</h2>
      {paragraphs.length > 0 ? (
        paragraphs.map((p, i) => <p key={i}>{p}</p>)
      ) : (
        <p className="notice">The reading for this lesson has not been added yet.</p>
      )}
    </section>
  );
}

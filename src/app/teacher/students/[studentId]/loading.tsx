// Loading state for the student detail page. Owned by the Teacher dashboard.
import styles from "@/components/teacher/teacher.module.css";

export default function Loading() {
  return (
    <p className={`card ${styles.skeleton}`} role="status">
      Loading student work&hellip;
    </p>
  );
}

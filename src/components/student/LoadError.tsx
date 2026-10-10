// Readable error with a retry link, shown when a read-only query fails. No fallback data is ever shown.
import Link from "next/link";
import styles from "./student.module.css";

export function LoadError({ message, retryHref }: { message: string; retryHref: string }) {
  return (
    <section className="card" role="alert">
      <h1>Something went wrong</h1>
      <p className="error">{message}</p>
      <div className={styles.actions}>
        <Link className={`btn ${styles.primary}`} href={retryHref}>
          Try again
        </Link>
      </div>
    </section>
  );
}

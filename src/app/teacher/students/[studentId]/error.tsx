"use client";
// Boundary for unexpected failures on the detail page. Owned by the Teacher dashboard.
// The raw error and its digest are never shown, and the error object is not logged from the browser.
import Link from "next/link";

export default function StudentDetailError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="card" aria-labelledby="err-heading">
      <h1 id="err-heading">Something went wrong</h1>
      <p className="error" role="alert">
        This student&rsquo;s page could not be shown. Try again, or go back to the class dashboard.
      </p>
      <p>
        <button type="button" className="btn" onClick={() => retry()}>
          Try again
        </button>{" "}
        <Link className="btn btn-secondary" href="/teacher">
          Back to class dashboard
        </Link>
      </p>
    </section>
  );
}

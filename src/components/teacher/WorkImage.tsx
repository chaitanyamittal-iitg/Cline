"use client";
// Original handwritten work, shown from a short-lived signed URL. TEACHER-OWNED.
// Client component only so a failed image load can show a fallback and a fresh link can be requested by
// re-running the server page (router.refresh()). It imports nothing server-only and never stores or logs the URL.
// A plain <img> is used on purpose: next/image would need remotePatterns in next.config.ts (lead-owned), and
// signed, expiring URLs should not pass through an image optimiser cache.
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./teacher.module.css";

export function WorkImage({ url, label }: { url: string; label: string }) {
  const router = useRouter();
  const [loadFailed, setLoadFailed] = useState(false);

  return (
    <div className={styles.imageFrame}>
      {loadFailed ? (
        <p className="error" role="alert">
          The handwritten image could not be loaded. The link may have expired or the file may be unavailable.
        </p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.image}
          src={url}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => setLoadFailed(true)}
        />
      )}
      <div className={styles.imageActions}>
        <button type="button" className="btn btn-secondary" onClick={() => router.refresh()}>
          Get a fresh image link
        </button>
        {!loadFailed && (
          <a className="btn btn-secondary" href={url} target="_blank" rel="noopener noreferrer">
            Open image in a new tab
          </a>
        )}
      </div>
      <p className={styles.sectionNote}>Image links expire after five minutes. Reload to request a new one.</p>
    </div>
  );
}

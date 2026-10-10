"use client";

// Shows ONE approved diagram, graphic or video. Only resources the database marked approved reach this component.
// If the picture file cannot be loaded (some diagram files are still placeholders), we say so and show the
// stored description instead. We never draw or invent a picture.
import { useState } from "react";
import { imageSource } from "@/lib/student/resources";
import { planVideo } from "@/lib/student/video";
import type { VisualResourceView } from "@/lib/student/journey-types";
import styles from "./student.module.css";

export function ApprovedVisual({ visual }: { visual: VisualResourceView }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (visual.kind === "video") {
    const plan = planVideo(visual.url);
    return (
      <figure className={styles.visual}>
        <figcaption className={styles.visualTitle}>{visual.title}</figcaption>
        {plan.type === "embed" && (
          <div className={styles.video}>
            <iframe src={plan.embedUrl} title={visual.title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        )}
        {plan.type === "file" && (
          <div className={styles.video}>
            <video controls preload="metadata" src={plan.src} />
          </div>
        )}
        {plan.type === "external" && (
          <a className="btn btn-secondary" href={plan.href} target="_blank" rel="noopener noreferrer">
            Watch this video (opens in a new tab)
          </a>
        )}
        {plan.type === "unavailable" && <p className={styles.visualNote}>This video has not been added yet.</p>}
      </figure>
    );
  }

  const src = imageSource(visual.url);
  return (
    <figure className={styles.visual}>
      <figcaption className={styles.visualTitle}>{visual.title}</figcaption>
      {src && !imageFailed ? (
        // A plain <img> on purpose: approved diagrams are small files from /public or an https address, and the
        // Next image optimiser would need a remote-host allow-list in next.config.ts, which this team does not own.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.visualImage} src={src} alt={visual.body ?? visual.title} onError={() => setImageFailed(true)} />
      ) : (
        <p className={styles.visualNote}>
          The picture is not available yet.{visual.body ? ` It shows: ${visual.body}` : ""}
        </p>
      )}
    </figure>
  );
}

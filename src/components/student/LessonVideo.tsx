// Shows one approved recorded lesson. Embeds only a supported player or direct video file;
// otherwise a clear external link; if the seeded URL is still a placeholder, says so honestly.
import { planVideo } from "@/lib/student/video";
import type { LessonResource } from "@/lib/student/queries";
import styles from "./student.module.css";

export function LessonVideo({ video }: { video: LessonResource }) {
  const plan = planVideo(video.url);
  return (
    <section className="card" aria-labelledby={`video-${video.id}`}>
      <p className={styles.step}>Watch</p>
      <h2 id={`video-${video.id}`}>{video.title}</h2>

      {plan.type === "embed" && (
        <>
          <div className={styles.video}>
            <iframe
              src={plan.embedUrl}
              title={video.title}
              loading="lazy"
              allow="fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <p className={styles.videoNote}>
            Video not playing?{" "}
            <a href={plan.watchUrl} target="_blank" rel="noopener noreferrer">
              Open it on {plan.provider}
            </a>
            .
          </p>
        </>
      )}

      {plan.type === "file" && (
        <>
          <div className={styles.video}>
            <video controls preload="metadata" src={plan.src}>
              Your browser cannot play this video.
            </video>
          </div>
          <p className={styles.videoNote}>
            Video not playing?{" "}
            <a href={plan.src} target="_blank" rel="noopener noreferrer">
              Open the video file
            </a>
            .
          </p>
        </>
      )}

      {plan.type === "external" && (
        <p>
          <a className="btn btn-secondary" href={plan.href} target="_blank" rel="noopener noreferrer">
            Watch the lesson video (opens in a new tab)
          </a>
        </p>
      )}

      {plan.type === "unavailable" && (
        <p className="notice">
          The recorded lesson has not been added yet. Please read the notes below, or ask your teacher about the video.
        </p>
      )}
    </section>
  );
}

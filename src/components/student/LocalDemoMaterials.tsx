// TEMPORARY, clearly labelled local-demo section for concept C3. Not database content: these items come from the
// supplied content pack and were NOT uploaded to Supabase or approved there. Rendered only by the concept page, after
// the authenticated concept-access check, and only while the database has no usable recorded lesson.
// Replace by real approved `resources` rows, then delete this file, local-demo-c3.ts and public/study-materials/c3/.
import {
  LOCAL_DEMO_READING,
  LOCAL_DEMO_READING_PDF,
  LOCAL_DEMO_VIDEOS,
  LOCAL_DEMO_VIDEOS_INTRO,
  LOCAL_DEMO_VIDEO_SAFETY,
} from "@/lib/student/local-demo-c3";
import { planVideo } from "@/lib/student/video";
import styles from "./student.module.css";

export function LocalDemoMaterials() {
  return (
    <section className={`card ${styles.demoSection}`} aria-labelledby="local-demo-heading">
      <p className={styles.demoTag}>Temporary local demo materials</p>
      <h2 id="local-demo-heading">Study materials for this demo</h2>
      <p className="notice" role="note">
        These materials come from the team&rsquo;s content pack and are shown here for this demo only. They are not yet
        saved or approved in the learning database.
      </p>

      <h3 className={styles.demoSub}>Watch</h3>
      <p className="muted">{LOCAL_DEMO_VIDEOS_INTRO}</p>
      <ol className={styles.demoVideos}>
        {LOCAL_DEMO_VIDEOS.map((video, index) => {
          const plan = planVideo(video.url);
          return (
            <li key={video.id} className={styles.demoVideo}>
              <p className={styles.demoVideoTitle}>
                {index + 1}. {video.title}
              </p>
              <p className={styles.demoMeta}>
                <strong>Useful range: </strong>
                {video.usefulRange}
              </p>
              <p className={styles.demoMeta}>
                <strong>Watch for: </strong>
                {video.watchFor}
              </p>
              {plan.type === "embed" && (
                <div className={styles.video}>
                  <iframe src={plan.embedUrl} title={video.title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                </div>
              )}
              {plan.type === "file" && (
                <div className={styles.video}>
                  <video controls preload="metadata" src={plan.src} />
                </div>
              )}
              {plan.type === "external" && (
                <a className="btn btn-secondary" href={plan.href} target="_blank" rel="noopener noreferrer">
                  Watch on Khan Academy (opens in a new tab)
                </a>
              )}
              {plan.type === "unavailable" && <p className="notice">This video link is not available.</p>}
            </li>
          );
        })}
      </ol>
      <p className={styles.demoMeta}>{LOCAL_DEMO_VIDEO_SAFETY}</p>

      <h3 className={styles.demoSub}>Read</h3>
      <article className={styles.reading} aria-labelledby="local-demo-reading-title">
        <h4 id="local-demo-reading-title" className={styles.demoReadingTitle}>
          {LOCAL_DEMO_READING.title}
        </h4>
        <p className="muted">{LOCAL_DEMO_READING.intro}</p>
        {LOCAL_DEMO_READING.sections.map((section) => (
          <div key={section.heading}>
            <h5 className={styles.demoReadingHeading}>{section.heading}</h5>
            {section.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        ))}
        <h5 className={styles.demoReadingHeading}>{LOCAL_DEMO_READING.rememberHeading}</h5>
        <ul className={styles.demoList}>
          {LOCAL_DEMO_READING.remember.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.demoMeta}>{LOCAL_DEMO_READING.safety}</p>
      </article>
      <p>
        <a className="btn btn-secondary" href={LOCAL_DEMO_READING_PDF} target="_blank" rel="noopener noreferrer">
          Open the reading as a PDF (opens in a new tab)
        </a>
      </p>
    </section>
  );
}

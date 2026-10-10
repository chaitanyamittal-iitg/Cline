// Label for the recorded source of stored AI-derived content. TEACHER-OWNED.
// Only a stored value of exactly "live" is called Live AI; mock is labelled MOCK AI; anything else is "unknown".
import { aiSourceInfo } from "@/lib/teacher/labels";
import styles from "./teacher.module.css";

export function SourceBadge({ source }: { source: string | null | undefined }) {
  const info = aiSourceInfo(source);
  const tone = info.tone === "mock" ? "badge-mock" : info.tone === "live" ? "badge-live" : styles.badgeUnknown;
  return <span className={`badge ${tone}`}>{info.label}</span>;
}

// Label for AI-produced output. The header badge (AppShell) is server-only, so client screens use this one.
import type { AiSource } from "@/lib/contracts";
import { aiLabel } from "@/lib/student/resources";

export function SourceBadge({ source, prefix }: { source: AiSource; prefix?: string }) {
  return (
    <span className={`badge ${source === "mock" ? "badge-mock" : "badge-live"}`} title="Which AI wrote this">
      {prefix ? `${prefix} ` : ""}
      {aiLabel(source)}
    </span>
  );
}

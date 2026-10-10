// Server-side wrapper: shows the signed image for one stored upload_path, or a clear fallback. TEACHER-OWNED.
import type { ImageResult } from "@/lib/teacher/types";
import { WorkImage } from "./WorkImage";

export function UploadedWork({ result, label }: { result: ImageResult | undefined; label: string }) {
  if (result?.ok) return <WorkImage url={result.url} label={label} />;
  const reason =
    result?.reason === "outside_student_folder"
      ? "The stored file path is not inside this student's folder, so it was not opened."
      : "A secure link for the handwritten image could not be created. Reload the page to try again.";
  return (
    <p className="error" role="alert">
      {reason}
    </p>
  );
}

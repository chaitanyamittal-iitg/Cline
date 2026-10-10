// Short-lived signed URLs for handwritten work. TEACHER-OWNED. Server only.
// - Uses the teacher's own session on the existing private "student-work" bucket (storage RLS applies).
// - Signs ONLY paths inside the selected student's folder (see images.ts).
// - URLs are never persisted, cached, logged or built with getPublicUrl(). A page reload requests fresh ones.
// Access to a real stored file has NOT been verified yet; failures surface as a visible fallback in the UI.
import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPathInStudentFolder, SIGNED_URL_SECONDS, STUDENT_WORK_BUCKET } from "./images";
import type { ImageResult } from "./types";

export async function signWorkImages(
  sb: SupabaseClient,
  studentId: string,
  paths: string[],
): Promise<Record<string, ImageResult>> {
  const results: Record<string, ImageResult> = {};
  const unique = [...new Set(paths)];
  const signable: string[] = [];
  for (const path of unique) {
    if (isPathInStudentFolder(path, studentId)) signable.push(path);
    else results[path] = { ok: false, reason: "outside_student_folder" };
  }
  if (signable.length === 0) return results;

  try {
    const { data, error } = await sb.storage.from(STUDENT_WORK_BUCKET).createSignedUrls(signable, SIGNED_URL_SECONDS);
    if (error || !data) {
      console.error("[teacher] signing handwritten images failed");
      for (const path of signable) results[path] = { ok: false, reason: "signing_failed" };
      return results;
    }
    for (const path of signable) {
      const entry = data.find((item) => item.path === path);
      results[path] =
        entry && !entry.error && entry.signedUrl
          ? { ok: true, url: entry.signedUrl }
          : { ok: false, reason: "signing_failed" };
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("[teacher] signing handwritten images threw");
    for (const path of signable) results[path] = { ok: false, reason: "signing_failed" };
  }
  return results;
}

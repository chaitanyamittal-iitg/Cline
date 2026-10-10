// Rules for the private handwritten-image bucket. TEACHER-OWNED. Pure (unit-tested in images.test.ts).
// Signed URLs themselves are created in queries.ts with the teacher's own session; nothing here touches the network.

/** Existing private bucket created in 0004_policies_storage.sql. */
export const STUDENT_WORK_BUCKET = "student-work";

/** Signed links are short-lived on purpose. A page reload requests fresh ones. */
export const SIGNED_URL_SECONDS = 300;

/**
 * Files live at "<studentId>/<file>". Only sign a stored path that sits directly inside the selected
 * student's own folder, with no empty, "." or ".." segments, so a bad stored value can never point at
 * another student's file or escape the folder.
 */
export function isPathInStudentFolder(path: string, studentId: string): boolean {
  if (!studentId || path.includes("\\")) return false;
  const segments = path.split("/");
  if (segments.length < 2) return false;
  if (segments[0] !== studentId) return false;
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

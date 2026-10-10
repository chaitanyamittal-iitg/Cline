// Checks a chosen picture against the upload contract BEFORE sending it. The server checks again.
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/contracts";

/** Value for the file input's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = ALLOWED_UPLOAD_TYPES.join(",");

const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

/** Returns a plain-English problem, or null when the file may be sent. */
export function validateUploadFile(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return "Please choose a JPEG, PNG or WebP picture.";
  }
  if (file.size <= 0) return "That picture looks empty. Please choose another one.";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That picture is too big. Please choose one smaller than ${MAX_MB} MB.`;
  }
  return null;
}

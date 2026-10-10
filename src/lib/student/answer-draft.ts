// The student's unsent work for one question, and how it becomes the contract's AnswerInput.
// Pure and client-safe. A photo answer is only sendable once the picture is uploaded AND the student has
// confirmed (or corrected) the text, so `confirmedText` always travels with `uploadPath`.
import type { AnswerInput, HandwritingReading } from "@/lib/contracts";

export type AnswerMode = "type" | "photo";
export type PhotoStatus = "idle" | "uploading" | "uploaded" | "failed";

export interface PhotoDraft {
  /** Kept so a failed upload can be retried without choosing the picture again. */
  file: File | null;
  fileName: string | null;
  previewUrl: string | null;
  status: PhotoStatus;
  error: string | null;
  uploadPath: string | null;
  reading: HandwritingReading | null;
  /** The editable text the student reviews. */
  text: string;
  confirmed: boolean;
}

export interface AnswerDraft {
  mode: AnswerMode;
  typed: string;
  photo: PhotoDraft;
}

export function emptyPhoto(): PhotoDraft {
  return {
    file: null,
    fileName: null,
    previewUrl: null,
    status: "idle",
    error: null,
    uploadPath: null,
    reading: null,
    text: "",
    confirmed: false,
  };
}

export function emptyDraft(): AnswerDraft {
  return { mode: "type", typed: "", photo: emptyPhoto() };
}

export function isUploading(draft: AnswerDraft): boolean {
  return draft.photo.status === "uploading";
}

/** The answer to send for this question, or null when it is not ready yet. */
export function buildAnswer(questionId: string, draft: AnswerDraft): AnswerInput | null {
  if (draft.mode === "type") {
    const typedText = draft.typed.trim();
    return typedText ? { questionId, typedText } : null;
  }
  const { photo } = draft;
  const confirmedText = photo.text.trim();
  if (photo.status === "uploaded" && photo.uploadPath && photo.confirmed && confirmedText) {
    return { questionId, uploadPath: photo.uploadPath, confirmedText };
  }
  return null;
}

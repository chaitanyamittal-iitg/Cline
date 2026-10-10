"use client";

// The photo branch of an answer. The picture goes through POST /api/upload; the student then reviews and CONFIRMS
// the text for it. The AI reading is only a draft (in mock mode nothing is read), so the answer becomes sendable
// only once the student has confirmed text. The chosen file is kept so a failed upload can be retried.
import { useEffect } from "react";
import { UploadResponseSchema } from "@/lib/contracts";
import { postForm } from "@/lib/student/api-client";
import { emptyPhoto, type AnswerDraft } from "@/lib/student/answer-draft";
import { guidanceForReading } from "@/lib/student/handwriting";
import { ACCEPT_ATTRIBUTE, validateUploadFile } from "@/lib/student/upload";
import { SourceBadge } from "./SourceBadge";
import { usePending } from "./usePending";
import styles from "./student.module.css";

export type DraftUpdater = (change: (draft: AnswerDraft) => AnswerDraft) => void;

export function PhotoAnswer({
  inputId,
  attemptId,
  questionId,
  draft,
  update,
}: {
  inputId: string;
  attemptId: string;
  questionId: string;
  draft: AnswerDraft;
  update: DraftUpdater;
}) {
  const uploader = usePending();
  const { photo } = draft;

  // Free the in-browser preview when it is replaced or the screen closes.
  useEffect(() => {
    const url = photo.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo.previewUrl]);

  async function sendFile(file: File) {
    await uploader.run(async () => {
      update((d) => ({ ...d, photo: { ...d.photo, file, fileName: file.name, status: "uploading", error: null } }));
      const form = new FormData();
      form.append("attemptId", attemptId);
      form.append("questionId", questionId);
      form.append("file", file);
      const result = await postForm("/api/upload", form, UploadResponseSchema);
      if (!result.ok) {
        update((d) => ({ ...d, photo: { ...d.photo, status: "failed", error: result.error } }));
        return;
      }
      const guidance = guidanceForReading(result.data.reading);
      update((d) => ({
        ...d,
        photo: {
          ...d.photo,
          status: "uploaded",
          error: null,
          uploadPath: result.data.uploadPath,
          reading: result.data.reading,
          text: guidance.draft,
          confirmed: false,
        },
      }));
    });
  }

  function choose(file: File | undefined) {
    if (!file) return;
    const problem = validateUploadFile(file);
    if (problem) {
      update((d) => ({ ...d, photo: { ...emptyPhoto(), status: "failed", error: problem } }));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    update((d) => ({ ...d, photo: { ...emptyPhoto(), previewUrl, file, fileName: file.name } }));
    void sendFile(file);
  }

  const guidance = photo.reading ? guidanceForReading(photo.reading) : null;

  return (
    <div className={styles.photoBox}>
      <label htmlFor={`${inputId}-file`}>Photo of your handwritten answer</label>
      <input
        id={`${inputId}-file`}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        disabled={uploader.pending}
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <p className={styles.hint}>JPEG, PNG or WebP, smaller than 5 MB.</p>

      {photo.previewUrl && (
        // Local preview of the student's own picture (a blob URL); the Next image optimiser cannot serve it.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.preview} src={photo.previewUrl} alt={`Your picture ${photo.fileName ?? ""}`.trim()} />
      )}
      {photo.status === "uploading" && <p role="status">Uploading your picture&hellip;</p>}
      {photo.status === "failed" && (
        <div role="alert">
          <p className="error">{photo.error}</p>
          {photo.file && (
            <button type="button" className="btn btn-secondary" disabled={uploader.pending} onClick={() => photo.file && void sendFile(photo.file)}>
              Try uploading again
            </button>
          )}
        </div>
      )}

      {photo.status === "uploaded" && guidance && (
        <div className={styles.review}>
          <p className="notice" role="status">
            {guidance.message} {photo.reading && <SourceBadge source={photo.reading.source} />}
          </p>
          <label htmlFor={`${inputId}-text`}>What does your picture say?</label>
          <textarea
            id={`${inputId}-text`}
            rows={5}
            maxLength={4000}
            value={photo.text}
            onChange={(e) => update((d) => ({ ...d, photo: { ...d.photo, text: e.target.value, confirmed: false } }))}
            placeholder="Type the words from your picture"
          />
          <div className={styles.actions}>
            {photo.confirmed ? (
              <p className={styles.confirmed} role="status">
                &#10003; You confirmed this text
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={photo.text.trim().length === 0}
                onClick={() => update((d) => ({ ...d, photo: { ...d.photo, confirmed: true } }))}
              >
                Yes, this is what I wrote
              </button>
            )}
            <button type="button" className={styles.linkButton} onClick={() => update((d) => ({ ...d, photo: emptyPhoto() }))}>
              Choose a different picture
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

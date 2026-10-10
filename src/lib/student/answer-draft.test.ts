import { describe, expect, it } from "vitest";
import { AnswerInputSchema, type HandwritingReading } from "@/lib/contracts";
import { ACCEPT_ATTRIBUTE, validateUploadFile } from "./upload";
import { buildAnswer, emptyDraft, emptyPhoto, isUploading, type AnswerDraft } from "./answer-draft";
import { guidanceForReading, MOCK_NO_HANDWRITING_MESSAGE } from "./handwriting";

const notReadMock: HandwritingReading = { status: "not_read", draftText: null, source: "mock" };

function photoDraft(over: Partial<AnswerDraft["photo"]> = {}): AnswerDraft {
  return {
    ...emptyDraft(),
    mode: "photo",
    photo: { ...emptyPhoto(), status: "uploaded", uploadPath: "student/abc.png", text: "The bulb stays off", confirmed: true, ...over },
  };
}

describe("buildAnswer", () => {
  it("sends typed text trimmed, and nothing when it is blank", () => {
    expect(buildAnswer("Q1", { ...emptyDraft(), typed: "  It will not light  " })).toEqual({ questionId: "Q1", typedText: "It will not light" });
    expect(buildAnswer("Q1", { ...emptyDraft(), typed: "   " })).toBeNull();
  });

  it("always sends confirmedText together with uploadPath", () => {
    const answer = buildAnswer("Q1", photoDraft());
    expect(answer).toEqual({ questionId: "Q1", uploadPath: "student/abc.png", confirmedText: "The bulb stays off" });
    expect(AnswerInputSchema.safeParse(answer).success).toBe(true);
  });

  it("is not ready until the student has confirmed the text", () => {
    expect(buildAnswer("Q1", photoDraft({ confirmed: false }))).toBeNull();
  });

  it("is not ready with empty confirmed text, even if it was ticked", () => {
    expect(buildAnswer("Q1", photoDraft({ text: "   " }))).toBeNull();
  });

  it("is not ready while the picture is still uploading or has failed", () => {
    expect(buildAnswer("Q1", photoDraft({ status: "uploading" }))).toBeNull();
    expect(buildAnswer("Q1", photoDraft({ status: "failed", uploadPath: null }))).toBeNull();
  });

  it("never sends typed text left over from the other mode", () => {
    const draft = { ...photoDraft(), typed: "old typed text" };
    expect(buildAnswer("Q1", draft)).toEqual({ questionId: "Q1", uploadPath: "student/abc.png", confirmedText: "The bulb stays off" });
  });

  it("reports an upload in progress", () => {
    expect(isUploading(photoDraft({ status: "uploading" }))).toBe(true);
    expect(isUploading(photoDraft())).toBe(false);
  });
});

describe("guidanceForReading", () => {
  it("says plainly that mock mode cannot read handwriting, and offers no text", () => {
    const g = guidanceForReading(notReadMock);
    expect(g.message).toBe("Mock mode does not read handwriting. Please type the text in your image.");
    expect(g.message).toBe(MOCK_NO_HANDWRITING_MESSAGE);
    expect(g.draft).toBe("");
  });

  it("asks the student to check a real reading", () => {
    const g = guidanceForReading({ status: "read", draftText: "no current flows", source: "live" });
    expect(g.message).toMatch(/is this what you wrote/i);
    expect(g.draft).toBe("no current flows");
  });

  it("keeps partial text for an unclear reading and asks the student to fix it", () => {
    const g = guidanceForReading({ status: "unclear", draftText: "the bu_b", source: "live" });
    expect(g.message).toMatch(/could not read this clearly/i);
    expect(g.draft).toBe("the bu_b");
  });

  it("does not use the mock sentence for a live reading that failed", () => {
    const g = guidanceForReading({ status: "not_read", draftText: null, source: "live" });
    expect(g.message).not.toMatch(/mock/i);
    expect(g.draft).toBe("");
  });
});

describe("validateUploadFile", () => {
  it("accepts JPEG, PNG and WebP up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateUploadFile({ type, size: 1000 })).toBeNull();
    }
    expect(validateUploadFile({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
  });

  it("refuses other types, empty files and files over 5 MB", () => {
    expect(validateUploadFile({ type: "application/pdf", size: 1000 })).toMatch(/JPEG, PNG or WebP/);
    expect(validateUploadFile({ type: "image/gif", size: 1000 })).not.toBeNull();
    expect(validateUploadFile({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(validateUploadFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });

  it("limits the file picker to the contract's types", () => {
    expect(ACCEPT_ATTRIBUTE).toBe("image/jpeg,image/png,image/webp");
  });
});

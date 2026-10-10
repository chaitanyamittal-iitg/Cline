// What to tell the student about an uploaded picture, based on the contract's HandwritingReading.
// The AI reading is only a DRAFT: the student always confirms or corrects it. Text is never invented here.
import type { HandwritingReading } from "@/lib/contracts";

export const MOCK_NO_HANDWRITING_MESSAGE = "Mock mode does not read handwriting. Please type the text in your image.";

export interface ReadingGuidance {
  message: string;
  /** Text to pre-fill the editable box with. Empty unless the reading really produced text. */
  draft: string;
}

export function guidanceForReading(reading: HandwritingReading): ReadingGuidance {
  switch (reading.status) {
    case "read":
      return {
        message: "Is this what you wrote? Please check the text and fix anything that is wrong.",
        draft: reading.draftText ?? "",
      };
    case "unclear":
      return {
        message:
          "We could not read this clearly. Please check the text below and fix it, or type what your picture says.",
        draft: reading.draftText ?? "",
      };
    case "not_read":
      return {
        message:
          reading.source === "mock"
            ? MOCK_NO_HANDWRITING_MESSAGE
            : "We could not read your picture. Please type what it says.",
        draft: "",
      };
  }
}

// The shape the feedback screen renders, whether it came from a fresh API response or from persisted rows.
// Pure and client-safe. Nothing numeric lives here: results are right/wrong/needs-clarification only.
import type { AttemptOutcome, Diagnosis, FollowUp, SubmitAnswersResponse } from "@/lib/contracts";

export interface YourAnswer {
  questionId: string;
  text: string;
  fromPhoto: boolean;
  /** The student's reply to a follow-up, when there was one. */
  clarification: string | null;
}

export interface FeedbackModel {
  /** `isCorrect: null` means a clarification is needed. It is never shown as "wrong". */
  results: SubmitAnswersResponse["results"];
  diagnoses: Diagnosis[];
  followUps: FollowUp[];
  /** Null when the persisted rows are not complete enough to judge the sitting yet. */
  attemptOutcome: AttemptOutcome | null;
  yourAnswers: YourAnswer[];
}

export function feedbackFromResponse(response: SubmitAnswersResponse, yourAnswers: YourAnswer[]): FeedbackModel {
  return {
    results: response.results,
    diagnoses: response.diagnoses,
    followUps: response.followUps,
    attemptOutcome: response.attemptOutcome,
    yourAnswers,
  };
}

/** Folds a follow-up response into the feedback already on screen. The response's open follow-ups are authoritative. */
export function mergeFollowUpResponse(
  previous: FeedbackModel,
  response: SubmitAnswersResponse,
  questionId: string,
  reply: string,
): FeedbackModel {
  const results = new Map(previous.results.map((r) => [r.questionId, r]));
  for (const r of response.results) results.set(r.questionId, r);

  const diagnoses = new Map(previous.diagnoses.map((d) => [d.questionId, d]));
  for (const d of response.diagnoses) diagnoses.set(d.questionId, d);

  return {
    results: [...results.values()],
    diagnoses: [...diagnoses.values()],
    followUps: response.followUps,
    attemptOutcome: response.attemptOutcome,
    yourAnswers: previous.yourAnswers.map((a) => (a.questionId === questionId ? { ...a, clarification: reply } : a)),
  };
}

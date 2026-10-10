// Feedback for one sitting: reasoning feedback and diagnoses, never a score. A question with no verdict yet
// (isCorrect: null) is shown as a quick clarification, never as wrong. Diagnoses are AI output, so each carries its
// MOCK AI / Live AI label.
import { outcomeMessage, verdictFor } from "@/lib/student/feedback-text";
import type { FeedbackModel } from "@/lib/student/feedback-model";
import type { ConceptProgress } from "@/lib/contracts";
import type { PromptQuestion } from "@/lib/student/journey-types";
import { SourceBadge } from "./SourceBadge";
import styles from "./student.module.css";

const VERDICT_CLASS = {
  good: styles.verdictGood,
  reasoning: styles.verdictReasoning,
  notyet: styles.verdictNotYet,
  clarify: styles.verdictClarify,
  teacher: styles.verdictTeacher,
} as const;

export function OutcomeBanner({ feedback, progress }: { feedback: FeedbackModel; progress: Pick<ConceptProgress, "state" | "teacherFlagged"> }) {
  const message = outcomeMessage(feedback.attemptOutcome, progress);
  const tone = message.tone === "waiting" ? styles.toneWaiting : message.tone === "attention" ? styles.toneAttention : "";
  return (
    <div className={`${styles.stateNotice} ${tone}`} role="status">
      <h2>{message.title}</h2>
      <p>{message.detail}</p>
    </div>
  );
}

export function FeedbackView({ questions, feedback }: { questions: PromptQuestion[]; feedback: FeedbackModel }) {
  const resultByQuestion = new Map(feedback.results.map((r) => [r.questionId, r.isCorrect]));
  const diagnosisByQuestion = new Map(feedback.diagnoses.map((d) => [d.questionId, d]));
  const answerByQuestion = new Map(feedback.yourAnswers.map((a) => [a.questionId, a]));

  return (
    <ol className={styles.feedbackList}>
      {questions.map((q, i) => {
        if (!resultByQuestion.has(q.id)) return null;
        const result = resultByQuestion.get(q.id) ?? null;
        const diagnosis = diagnosisByQuestion.get(q.id);
        const verdict = verdictFor(result, diagnosis);
        const answer = answerByQuestion.get(q.id);
        return (
          <li key={q.id} className={`${styles.feedbackItem} ${VERDICT_CLASS[verdict.kind]}`}>
            <p className={styles.questionLegend}>Question {i + 1}</p>
            <p className={styles.questionPrompt}>{q.prompt}</p>
            {answer && answer.text && (
              <p className={styles.yourAnswer}>
                <strong>{answer.fromPhoto ? "Your answer (from your photo): " : "Your answer: "}</strong>
                {answer.text}
              </p>
            )}
            {answer?.clarification && (
              <p className={styles.yourAnswer}>
                <strong>Your reply to the quick question: </strong>
                {answer.clarification}
              </p>
            )}
            <p className={styles.verdict}>
              <span aria-hidden="true">{verdict.icon}</span> {verdict.label}
            </p>
            {diagnosis && (
              <div className={styles.reasoning}>
                {diagnosis.misconception && (
                  <p>
                    <strong>Something to think about: </strong>
                    {diagnosis.misconception}
                  </p>
                )}
                <p>
                  <strong>Why: </strong>
                  {diagnosis.evidence}
                </p>
                <p>
                  <SourceBadge source={diagnosis.source} prefix="Feedback by" />
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

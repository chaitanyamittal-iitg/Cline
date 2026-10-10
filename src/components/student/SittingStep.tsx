"use client";

// The written test, its feedback, clarifications, extra help and the fresh reassessment, driven by the SAVED state.
// The screen shown always follows the server's progress and the saved attempt, never a local guess. After each
// successful server response, the page is re-read so persisted data replaces what was shown locally.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConceptId, ConceptProgress, SubmitAnswersResponse, SupportPlan } from "@/lib/contracts";
import { feedbackFromResponse, mergeFollowUpResponse, type FeedbackModel, type YourAnswer } from "@/lib/student/feedback-model";
import type { SittingView, TeacherSupportView, VisualResourceView } from "@/lib/student/journey-types";
import { canRequestSupport, needsTeacher } from "@/lib/student/progress";
import { AnswerForm } from "./AnswerForm";
import { FeedbackView, OutcomeBanner } from "./FeedbackView";
import { FollowUpForm } from "./FollowUpForm";
import { SourceBadge } from "./SourceBadge";
import { StartTestCard } from "./StartTestCard";
import { SupportPlanCard, TeacherSupportCard } from "./SupportPlanCard";
import { SupportStart } from "./SupportStart";
import styles from "./student.module.css";

export function SittingStep({
  conceptId,
  initialProgress,
  sitting,
  support,
  supportUnreadable,
  teacherSupport,
  visuals,
}: {
  conceptId: ConceptId;
  initialProgress: ConceptProgress;
  sitting: SittingView | null;
  support: SupportPlan | null;
  supportUnreadable: boolean;
  teacherSupport: TeacherSupportView[];
  visuals: VisualResourceView[];
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<ConceptProgress>(initialProgress);
  const [feedback, setFeedback] = useState<FeedbackModel | null>(sitting?.feedback ?? null);

  function submitted(response: SubmitAnswersResponse, yourAnswers: YourAnswer[]) {
    setFeedback(feedbackFromResponse(response, yourAnswers));
    setProgress(response.progress);
    router.refresh(); // re-read the saved attempt, answers and progress
  }

  function clarified(questionId: string, reply: string, response: SubmitAnswersResponse) {
    setFeedback((current) => (current ? mergeFollowUpResponse(current, response, questionId, reply) : current));
    setProgress(response.progress);
    router.refresh();
  }

  const teacherHelp = <TeacherSupportCard items={teacherSupport} visuals={visuals} />;

  // 1. The server says the student has no test yet.
  if (!sitting) {
    if (progress.state === "microtest") return <StartTestCard conceptId={conceptId} />;
    return (
      <section className="card">
        <p className="notice" role="status">
          Your next step is not ready to show yet. Please reload this page in a moment.
        </p>
      </section>
    );
  }

  const isReassessment = sitting.kind === "reassessment";
  const answering = feedback === null && (progress.state === "microtest" || progress.state === "reassessment");
  const flagged = needsTeacher(progress);
  const openFollowUps = feedback?.followUps ?? [];
  const promptOf = (id: string) => sitting.questions.find((q) => q.id === id)?.prompt ?? "";

  return (
    <>
      {isReassessment && support && <SupportPlanCard support={support} visuals={visuals} />}
      {isReassessment && !support && supportUnreadable && (
        <section className="card">
          <p className="notice" role="status">
            Your extra help could not be shown right now. Please reload this page.
          </p>
        </section>
      )}
      {teacherHelp}

      <section className="card" aria-labelledby="sitting-heading">
        <p className={styles.step}>{isReassessment ? "Fresh questions" : "Your written test"}</p>
        <h2 id="sitting-heading">{isReassessment ? "Try these fresh questions" : "Show what you know"}</h2>
        {isReassessment && sitting.source && (
          <p>
            <SourceBadge source={sitting.source} prefix="Questions written by" />
          </p>
        )}
        {answering && (
          <p className="muted">There are no marks. Answer in your own words. You can type or add a photo of your handwriting.</p>
        )}

        {answering ? (
          <AnswerForm key={sitting.attemptId} conceptId={conceptId} attemptId={sitting.attemptId} questions={sitting.questions} onSubmitted={submitted} />
        ) : feedback ? (
          <>
            <OutcomeBanner feedback={feedback} progress={progress} />
            <FeedbackView questions={sitting.questions} feedback={feedback} />
          </>
        ) : (
          <p className="notice" role="status">
            This step is saved. Please reload the page to see where you are.
          </p>
        )}
      </section>

      {!flagged && openFollowUps.length > 0 && (
        <section className="card" aria-labelledby="clarify-heading">
          <p className={styles.step}>Quick question</p>
          <h2 id="clarify-heading">Help us understand your thinking</h2>
          <p className="muted">This is not a wrong answer. We just want to be sure we understood you.</p>
          {openFollowUps.map((f) => (
            <FollowUpForm
              key={f.questionId}
              conceptId={conceptId}
              attemptId={sitting.attemptId}
              followUp={f}
              promptText={promptOf(f.questionId)}
              onDone={(response, reply) => clarified(f.questionId, reply, response)}
            />
          ))}
        </section>
      )}

      {canRequestSupport(progress) && openFollowUps.length === 0 && <SupportStart conceptId={conceptId} />}
    </>
  );
}

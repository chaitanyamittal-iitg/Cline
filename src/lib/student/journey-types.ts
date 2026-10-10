// Plain data shapes the post-lesson screens render. Type-only module, safe to import from client components.
import type { AiSource, ConceptProgress, SupportPlan, TeacherSupportContent } from "@/lib/contracts";
import type { FeedbackModel } from "./feedback-model";
import type { ConceptSummary } from "./progress";

/** A question as the student sees it: prompt only, never a key. */
export interface PromptQuestion {
  id: string;
  prompt: string;
}

export interface TutorMessageView {
  id: string;
  role: "student" | "tutor";
  content: string;
  resourceId: string | null;
  /** Set on tutor messages only. */
  source: AiSource | null;
}

/** An APPROVED diagram, graphic or video the tutor or support may point to. */
export interface VisualResourceView {
  id: string;
  kind: "diagram" | "graphic" | "video";
  title: string;
  url: string | null;
  body: string | null;
}

/** One sitting: the predefined micro-test or a reassessment. */
export interface SittingView {
  attemptId: string;
  kind: "microtest" | "reassessment";
  cycle: number;
  /** Who generated these questions. Null for the predefined micro-test (teacher-written, not AI). */
  source: AiSource | null;
  questions: PromptQuestion[];
  /** Null means the answers have not been sent yet. */
  feedback: FeedbackModel | null;
}

export interface TeacherSupportView {
  id: string;
  content: TeacherSupportContent;
}

export interface JourneyData {
  concept: ConceptSummary;
  progress: ConceptProgress;
  messages: TutorMessageView[];
  visuals: VisualResourceView[];
  /** The latest sitting for this concept, or null when none exists yet. */
  sitting: SittingView | null;
  /** The support plan that belongs to `sitting` (reassessments only). */
  support: SupportPlan | null;
  /** True when a support row exists but its content could not be read. */
  supportUnreadable: boolean;
  teacherSupport: TeacherSupportView[];
}

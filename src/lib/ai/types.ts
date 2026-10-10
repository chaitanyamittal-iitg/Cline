// SAFAL AI interface. LEAD-OWNED. Everything that talks to a model implements this.
// Server-side only: never import this file or its implementations into a client component.
import type {
  AiSource,
  ConceptId,
  Diagnosis,
  GeneratedQuestion,
  HomeworkItem,
  Reassessment,
  SupportPlan,
} from "@/lib/contracts";

/** A teacher-approved resource the AI is allowed to use. Nothing else may be used. */
export interface ApprovedResource {
  id: string;
  conceptId: ConceptId;
  kind: "lecture_video" | "reading" | "diagram" | "graphic" | "video";
  title: string;
  /** Reading text or a description of the diagram; the tutor may quote from this. */
  body: string | null;
}

export interface TutorInput {
  conceptId: ConceptId;
  studentMessage: string;
  approvedResources: ApprovedResource[];
}
export interface TutorOutput {
  reply: string;
  /** Must be one of the approvedResources ids, or null. */
  resourceId: string | null;
  source: AiSource;
}

export interface InterpretHandwritingInput {
  imageBytes: Uint8Array;
  mimeType: string;
  questionPrompt: string;
}
export interface InterpretHandwritingOutput {
  interpretedText: string;
  source: AiSource;
}

export interface DiagnoseInput {
  conceptId: ConceptId;
  questionId: string;
  questionPrompt: string;
  expectedIdea: string;
  knownMisconceptions: string[];
  /** Typed text, or the AI's reading of the handwritten image. */
  studentAnswer: string;
  /** Earlier diagnosis evidence, so one slip is not treated as the whole picture. */
  earlierEvidence: string[];
  approvedResources: ApprovedResource[];
}

export interface SupportInput {
  conceptId: ConceptId;
  cycleNumber: 1 | 2;
  diagnoses: Diagnosis[];
  approvedResources: ApprovedResource[];
}

export interface ReassessmentInput {
  conceptId: ConceptId;
  cycleNumber: 1 | 2;
  diagnoses: Diagnosis[];
  /** Prompts already used, so the new questions are fresh. */
  previousPrompts: string[];
  approvedResources: ApprovedResource[];
}

export interface HomeworkInput {
  /** Gaps observed across the school day, across concepts. */
  diagnoses: Diagnosis[];
  approvedResources: ApprovedResource[];
}
export interface HomeworkOutput {
  items: Omit<HomeworkItem, "id">[];
  source: AiSource;
}

export interface AiProvider {
  /** Human-readable name shown in the UI badge, e.g. "MOCK AI" or "Live AI". */
  readonly label: string;
  readonly source: AiSource;
  answerDoubt(input: TutorInput): Promise<TutorOutput>;
  interpretHandwriting(input: InterpretHandwritingInput): Promise<InterpretHandwritingOutput>;
  diagnose(input: DiagnoseInput): Promise<Diagnosis>;
  createSupport(input: SupportInput): Promise<SupportPlan>;
  createReassessment(input: ReassessmentInput): Promise<Reassessment>;
  createHomework(input: HomeworkInput): Promise<HomeworkOutput>;
}

export type { GeneratedQuestion };

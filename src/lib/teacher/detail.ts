// Read-only assembly for /teacher/students/[studentId]. TEACHER-OWNED. Server only.
// Uses the teacher's own session (RLS applies). Each section reports its own failure so working sections
// are still shown and a failed section is never displayed as "no data".
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAttemptViews, findUnlinkedDiagnoses } from "./attempts";
import { fetchStudentRecords, fetchQuestionPrompts } from "./detail-fetch";
import { fetchRows } from "./fetch";
import { isStudentIdFormat } from "./ids";
import { buildProgressViews, collectQuestionIds } from "./linking";
import { signWorkImages } from "./signing";
import { buildSupportCycleViews } from "./support";
import {
  ProfileRowSchema,
  type ConceptProgressView,
  type ImageResult,
  type QuestionRow,
  type SectionResult,
  type StudentIdentity,
} from "./types";
import type { AnswerView, AttemptView, SupportCycleView, UnlinkedDiagnosis } from "./view-types";

export interface WorkSection {
  attempts: AttemptView[];
  /** Answers whose attempt was not loaded. Shown separately, never attached to another attempt. */
  orphanAnswers: AnswerView[];
  diagnosesLoaded: boolean;
  questionPromptsLoaded: boolean;
}

export interface StudentDetail {
  student: StudentIdentity;
  progress: SectionResult<ConceptProgressView[]>;
  /** concept id -> title. Empty when concept titles could not be loaded. */
  conceptTitles: Record<string, string>;
  work: SectionResult<WorkSection>;
  /** Diagnoses with no verified answer link, listed at concept level. */
  unlinkedDiagnoses: SectionResult<UnlinkedDiagnosis[]>;
  support: SectionResult<SupportCycleView[]>;
  /** upload_path -> signed URL result, for this student's stored handwritten work only. */
  images: Record<string, ImageResult>;
}

export type StudentDetailResult =
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "ok"; detail: StudentDetail };

export async function loadStudentDetail(studentId: string): Promise<StudentDetailResult> {
  // A malformed id never reaches the database.
  if (!isStudentIdFormat(studentId)) return { status: "not_found" };
  const sb = await createSupabaseServerClient();

  const profile = await fetchRows("The student profile", ProfileRowSchema, () =>
    sb.from("profiles").select("id, role, display_name, class_label").eq("id", studentId),
  );
  if (!profile.ok) return { status: "error", message: profile.message };
  const row = profile.data[0];
  // Missing, hidden by RLS, or not a student: all look the same to the page.
  if (!row || row.role !== "student") return { status: "not_found" };
  const student: StudentIdentity = { id: row.id, displayName: row.display_name, classLabel: row.class_label };

  const [progress, concepts, attempts, answers, diagnoses, cycles] = await fetchStudentRecords(sb, student.id);

  const conceptRows = concepts.ok ? concepts.data : null;
  const conceptTitles = Object.fromEntries((conceptRows ?? []).map((c) => [c.id, c.title]));
  const attemptRows = attempts.ok ? attempts.data : null;
  const answerRows = answers.ok ? answers.data : null;
  const diagnosisRows = diagnoses.ok ? diagnoses.data : null;

  let questionBank: QuestionRow[] = [];
  let questionPromptsLoaded = true;
  const questionIds = collectQuestionIds(attemptRows ?? [], answerRows ?? []);
  if (questionIds.length > 0) {
    const bank = await fetchQuestionPrompts(sb, questionIds);
    if (bank.ok) questionBank = bank.data;
    else questionPromptsLoaded = false;
  }

  let work: SectionResult<WorkSection>;
  if (!attempts.ok) work = { ok: false, message: attempts.message };
  else if (!answers.ok) work = { ok: false, message: answers.message };
  else {
    const built = buildAttemptViews({
      attempts: attempts.data,
      answers: answers.data,
      diagnoses: diagnosisRows ?? [],
      questionBank,
      supportCycles: cycles.ok ? cycles.data : [],
    });
    work = { ok: true, data: { ...built, diagnosesLoaded: diagnoses.ok, questionPromptsLoaded } };
  }

  const paths = (answerRows ?? []).flatMap((a) => (a.upload_path ? [a.upload_path] : []));
  const images = paths.length > 0 ? await signWorkImages(sb, student.id, paths) : {};

  return {
    status: "ok",
    detail: {
      student,
      progress: progress.ok
        ? { ok: true, data: buildProgressViews(progress.data, conceptRows) }
        : { ok: false, message: progress.message },
      conceptTitles,
      work,
      unlinkedDiagnoses: diagnoses.ok
        ? { ok: true, data: findUnlinkedDiagnoses(diagnoses.data, answerRows) }
        : { ok: false, message: diagnoses.message },
      support: cycles.ok
        ? { ok: true, data: buildSupportCycleViews(cycles.data, diagnosisRows, attemptRows) }
        : { ok: false, message: cycles.message },
      images,
    },
  };
}

// TEMPORARY local-demo materials for concept C3 (Complete circuits).
// The text below is copied from the supplied content pack ("Cline Materials": 01_C3_Recorded_Lesson_and_Timestamps and
// 02_C3_Reading_Student). It is NOT from the database: it was not uploaded to Supabase and no teacher approved it
// there. Only student-facing items are used. No test, answer guide or teacher reference is included here.
// To replace it: put the real videos and reading in `resources` (approved = true), then delete this file,
// LocalDemoMaterials.tsx, the one line in src/app/student/[concept]/page.tsx and public/study-materials/c3/.
import type { ConceptId } from "@/lib/contracts";
import { planVideo } from "./video";

export const LOCAL_DEMO_CONCEPT: ConceptId = "C3";

/** Exported from 02_C3_Reading_Student. A public file: student-facing reading only. */
export const LOCAL_DEMO_READING_PDF = "/study-materials/c3/C3_Reading_Student.pdf";

export interface LocalDemoVideo {
  id: string;
  /** Shown as the link title. */
  title: string;
  usefulRange: string;
  watchFor: string;
  /** External link. The pack says these are linked, not downloaded or redistributed. */
  url: string;
}

export const LOCAL_DEMO_VIDEOS_INTRO = "Two short visual clips to watch before reading and answering the initial micro-test.";

export const LOCAL_DEMO_VIDEOS: LocalDemoVideo[] = [
  {
    id: "demo-c3-simple-circuit",
    title: "Khan Academy - Simple circuit (2:01)",
    usefulRange: "00:00-02:01 (the full video).",
    watchFor:
      "How the cell, connecting wires and bulb form one conducting path, and what the demonstration shows when the path is complete.",
    url: "https://www.khanacademy.org/science/uk-science-class-7-new/x2afa7396c019dcda%3Aelectricity-circuits-and-their-components/x2afa7396c019dcda%3Aincandescent-lamp-led/v/simple-circuit",
  },
  {
    id: "demo-c3-electric-switch",
    title: "Khan Academy - Electric Switch (3:10)",
    usefulRange: "00:00-03:10 (the full video).",
    watchFor: "How a switch either leaves a gap in the conducting path or bridges that gap.",
    url: "https://www.khanacademy.org/science/uk-science-class-6/xd0b69315c4e9e63b%3Aelectricity-and-circuits/xd0b69315c4e9e63b%3A12-4-electric-switch/v/electric-switch-electricity",
  },
];

export const LOCAL_DEMO_VIDEO_SAFETY =
  "Safety: use only teacher-approved low-voltage cell circuits. Never experiment with wall sockets or household mains wiring.";

export interface LocalDemoReadingSection {
  heading: string;
  paragraphs: string[];
}

export const LOCAL_DEMO_READING = {
  title: "When does a bulb glow?",
  intro: "Read this before the C3 initial micro-test.",
  sections: [
    {
      heading: "1. The parts of a simple circuit",
      paragraphs: [
        "A simple circuit can contain an electric cell, connecting wires, a bulb and a switch. The cell provides electrical energy. The wires connect the components. The bulb has two electrical contact points, and the wires must connect to those contact points rather than to the glass.",
      ],
    },
    {
      heading: "2. A complete conducting path",
      paragraphs: [
        "A circuit is complete when there is an unbroken conducting path from one terminal of the cell, through the connected components, and back to the other terminal. In a simple working circuit, this path includes both electrical contacts of the bulb. When the path is complete and the components are working, current can flow and the bulb can glow.",
        "Having every component is not enough. The components must be connected correctly. A wire that is loose, a connection made to the wrong part of a bulb, or a break anywhere in the path can stop current from flowing through the circuit.",
      ],
    },
    {
      heading: "3. Open and closed circuits",
      paragraphs: [
        "A closed circuit has a continuous conducting path. An open circuit has a gap or break in that path. A switch controls the path: when it is closed (ON), its conducting parts touch, so the switch no longer interrupts the path; when it is open (OFF), a gap remains at the switch. The whole circuit works only if the rest of the path is connected too. A switch can be placed at different points in the circuit; its job is still to make or break the path.",
      ],
    },
    {
      heading: "4. Explain the observation, not just the result",
      paragraphs: [
        "If a bulb does not glow, do not immediately conclude that the cell is dead or the bulb is faulty. The switch may be open, a wire may be loose, a connection may touch the wrong place, or a component may not work. Check the path and the components systematically. One observation usually does not identify the cause by itself.",
      ],
    },
  ] satisfies LocalDemoReadingSection[],
  rememberHeading: "Remember these ideas",
  remember: [
    "A complete circuit is an unbroken conducting loop between the two terminals of a cell.",
    "Both electrical contacts of the bulb must be connected into the path.",
    "An open switch creates a gap; a closed switch removes that gap, but cannot fix breaks elsewhere in the circuit.",
    "If the bulb stays off, use evidence and careful checks before deciding why.",
  ],
  safety:
    "Safety reminder: this lesson is about low-voltage cells and classroom components. Do not test ideas using household electrical outlets.",
};

/**
 * Whether to show the temporary section. Only for C3, and only while the database still has no usable recorded
 * lesson (no lecture video, or a placeholder URL). Callers must have passed the authenticated concept-access
 * check first; this function does not read anything.
 */
export function shouldShowLocalDemo(conceptId: ConceptId, databaseVideos: { url: string | null }[]): boolean {
  if (conceptId !== LOCAL_DEMO_CONCEPT) return false;
  return databaseVideos.length === 0 || databaseVideos.some((v) => planVideo(v.url).type === "unavailable");
}

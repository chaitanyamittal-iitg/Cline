import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCAL_DEMO_READING, LOCAL_DEMO_READING_PDF, LOCAL_DEMO_VIDEOS, shouldShowLocalDemo } from "./local-demo-c3";
import { planVideo } from "./video";

describe("shouldShowLocalDemo", () => {
  it("shows for C3 while the database video is still a placeholder", () => {
    expect(shouldShowLocalDemo("C3", [{ url: "PLACEHOLDER_VIDEO_URL" }])).toBe(true);
  });

  it("shows for C3 when the database has no recorded lesson at all", () => {
    expect(shouldShowLocalDemo("C3", [])).toBe(true);
  });

  it("steps aside once the database has a usable video", () => {
    expect(shouldShowLocalDemo("C3", [{ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }])).toBe(false);
  });

  it("never shows for any other concept, so future-concept material is not exposed", () => {
    for (const id of ["C1", "C2", "C4"] as const) {
      expect(shouldShowLocalDemo(id, [{ url: "PLACEHOLDER_VIDEO_URL" }]), id).toBe(false);
      expect(shouldShowLocalDemo(id, []), id).toBe(false);
    }
  });
});

describe("local demo content", () => {
  it("links the two supplied Khan Academy videos as external links, never embeds or downloads", () => {
    expect(LOCAL_DEMO_VIDEOS).toHaveLength(2);
    for (const video of LOCAL_DEMO_VIDEOS) {
      const plan = planVideo(video.url);
      expect(plan.type, video.id).toBe("external");
      expect(video.url.startsWith("https://www.khanacademy.org/")).toBe(true);
    }
  });

  it("contains the supplied student reading and no assessment, answer-guide or teacher wording", () => {
    const text = JSON.stringify(LOCAL_DEMO_READING).toLowerCase();
    expect(text).toContain("complete conducting path");
    for (const forbidden of ["answer guide", "teacher only", "teacher-only", "expected idea", "misconception", "c3-q"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });

  it("serves only the student reading PDF from public/study-materials/c3, with no tests, guides or large media", () => {
    expect(LOCAL_DEMO_READING_PDF).toBe("/study-materials/c3/C3_Reading_Student.pdf");
    const dir = path.resolve(process.cwd(), "public/study-materials/c3");
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      expect(name, name).toMatch(/\.(pdf|png|jpe?g|webp|svg)$/i);
      expect(name.toLowerCase(), name).not.toMatch(/teacher|answer|guide|microtest|test|homework|key/);
    }
  });
});

import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_AVAILABILITY,
  PHOTO_UNAVAILABLE_BUTTON,
  PHOTO_UNAVAILABLE_NOTICE,
  TUTOR_UNAVAILABLE_BUTTON,
  TUTOR_UNAVAILABLE_NOTICE,
} from "./demo-availability";

const routeExists = (segments: string[]) => existsSync(path.resolve(process.cwd(), "src/app/api", ...segments, "route.ts"));

describe("demo availability switches", () => {
  it("labels the controls plainly as unavailable for this demo", () => {
    for (const text of [TUTOR_UNAVAILABLE_NOTICE, TUTOR_UNAVAILABLE_BUTTON, PHOTO_UNAVAILABLE_NOTICE, PHOTO_UNAVAILABLE_BUTTON]) {
      expect(text.toLowerCase()).toContain("unavailable for this demo");
    }
  });

  it("points typed answers and skipping doubts at what still works", () => {
    expect(TUTOR_UNAVAILABLE_NOTICE).toMatch(/start your micro-test/i);
    expect(PHOTO_UNAVAILABLE_NOTICE).toMatch(/type your answer/i);
  });

  it("never marks a feature available whose backend route does not exist", () => {
    if (DEMO_AVAILABILITY.tutor) expect(routeExists(["tutor"])).toBe(true);
    if (DEMO_AVAILABILITY.photoUpload) expect(routeExists(["upload"])).toBe(true);
  });

  it("keeps the routes that the demo relies on in place", () => {
    expect(routeExists(["attempts", "start"])).toBe(true);
    expect(routeExists(["answers"])).toBe(true);
  });
});

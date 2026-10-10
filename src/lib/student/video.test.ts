import { describe, expect, it } from "vitest";
import { planVideo } from "./video";

describe("planVideo", () => {
  it("treats the seeded placeholder, blanks and relative paths as unavailable", () => {
    expect(planVideo("PLACEHOLDER_VIDEO_URL")).toEqual({ type: "unavailable" });
    expect(planVideo(null)).toEqual({ type: "unavailable" });
    expect(planVideo(undefined)).toEqual({ type: "unavailable" });
    expect(planVideo("   ")).toEqual({ type: "unavailable" });
    expect(planVideo("/diagrams/c3-open-circuit.svg")).toEqual({ type: "unavailable" });
  });

  it("rejects non-web protocols", () => {
    expect(planVideo("javascript:alert(1)")).toEqual({ type: "unavailable" });
    expect(planVideo("ftp://example.org/video.mp4")).toEqual({ type: "unavailable" });
  });

  it("embeds YouTube links through the privacy-enhanced player", () => {
    const expected = {
      type: "embed",
      provider: "YouTube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    };
    expect(planVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(expected);
    expect(planVideo("https://youtu.be/dQw4w9WgXcQ")).toEqual(expected);
    expect(planVideo("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual(expected);
  });

  it("does not embed a YouTube link without a valid video id", () => {
    expect(planVideo("https://www.youtube.com/watch?v=short")).toEqual({
      type: "external",
      href: "https://www.youtube.com/watch?v=short",
    });
  });

  it("embeds Vimeo links", () => {
    expect(planVideo("https://vimeo.com/123456789")).toEqual({
      type: "embed",
      provider: "Vimeo",
      embedUrl: "https://player.vimeo.com/video/123456789",
      watchUrl: "https://vimeo.com/123456789",
    });
  });

  it("uses the browser player only for direct https video files", () => {
    expect(planVideo("https://example.org/lessons/circuits.mp4")).toEqual({
      type: "file",
      src: "https://example.org/lessons/circuits.mp4",
    });
    expect(planVideo("http://example.org/lessons/circuits.mp4")).toEqual({
      type: "external",
      href: "http://example.org/lessons/circuits.mp4",
    });
  });

  it("offers any other web address as an external link, never an embed", () => {
    expect(planVideo("https://example.org/watch/circuits")).toEqual({
      type: "external",
      href: "https://example.org/watch/circuits",
    });
  });
});

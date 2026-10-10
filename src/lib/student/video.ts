// Decides how a lesson video URL can honestly be shown. Pure functions: no network, no environment.
// Embeds only well-known players over https; direct video files get the browser player;
// any other real web address is offered as an external link; anything else (for example the
// seeded "PLACEHOLDER_VIDEO_URL") is reported as not available yet. Nothing is ever invented.

export type VideoPlan =
  | { type: "embed"; provider: "YouTube" | "Vimeo"; embedUrl: string; watchUrl: string }
  | { type: "file"; src: string }
  | { type: "external"; href: string }
  | { type: "unavailable" };

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const FILE_EXTENSION = /\.(mp4|webm|ogg)$/i;

function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") candidate = url.searchParams.get("v");
    else if (["embed", "shorts", "live"].includes(parts[0] ?? "")) candidate = parts[1] ?? null;
  }
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

function vimeoId(url: URL): string | null {
  if (!VIMEO_HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const candidate = parts[0] === "video" ? parts[1] : parts[0];
  return candidate && VIMEO_ID.test(candidate) ? candidate : null;
}

export function planVideo(rawUrl: string | null | undefined): VideoPlan {
  const value = rawUrl?.trim();
  if (!value) return { type: "unavailable" };

  let url: URL;
  try {
    url = new URL(value); // relative paths and placeholder text are not valid absolute URLs
  } catch {
    return { type: "unavailable" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { type: "unavailable" };

  if (url.protocol === "https:") {
    const yt = youtubeId(url);
    if (yt) {
      return {
        type: "embed",
        provider: "YouTube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${yt}`,
        watchUrl: `https://www.youtube.com/watch?v=${yt}`,
      };
    }
    const vm = vimeoId(url);
    if (vm) {
      return {
        type: "embed",
        provider: "Vimeo",
        embedUrl: `https://player.vimeo.com/video/${vm}`,
        watchUrl: `https://vimeo.com/${vm}`,
      };
    }
    if (FILE_EXTENSION.test(url.pathname)) return { type: "file", src: url.toString() };
  }

  return { type: "external", href: url.toString() };
}

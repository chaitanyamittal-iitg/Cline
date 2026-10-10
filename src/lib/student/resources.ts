// Which approved-resource URLs may be shown as a picture. Pure and client-safe. Nothing is invented: a URL that
// is not clearly a local path or an https address is not shown as an image.

/** A src that is safe to put in an <img>, or null. Local paths such as "/diagrams/x.svg" and https URLs only. */
export function imageSource(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function aiLabel(source: "mock" | "live"): string {
  return source === "mock" ? "MOCK AI" : "Live AI";
}

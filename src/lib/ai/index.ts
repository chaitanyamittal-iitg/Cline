// Picks the AI provider from AI_PROVIDER. LEAD-OWNED. Server-side only.
import type { AiProvider } from "./types";
import { MockAiProvider } from "./providers/mock";
import { LiveAiProvider } from "./providers/live";

export function getAiProvider(kind: string | undefined = process.env.AI_PROVIDER): AiProvider {
  if (kind === "live") return new LiveAiProvider();
  // Default to mock so a missing setting can never silently call a paid API.
  return new MockAiProvider();
}

export type { AiProvider } from "./types";

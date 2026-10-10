// LIVE AI provider STUB. The AI-integration teammate replaces these bodies with real model calls.
// Until then, selecting AI_PROVIDER=live fails with a clear message instead of faking output.
import type { AiProvider } from "../types";

export class LiveAiNotConfiguredError extends Error {
  constructor() {
    super(
      "Live AI is not implemented yet. Set AI_PROVIDER=mock in .env.local, or implement src/lib/ai/providers/live.ts.",
    );
    this.name = "LiveAiNotConfiguredError";
  }
}

export class LiveAiProvider implements AiProvider {
  readonly label = "Live AI";
  readonly source = "live" as const;

  constructor(
    readonly apiKey: string | undefined = process.env.AI_API_KEY,
    readonly model: string | undefined = process.env.AI_MODEL,
  ) {}

  private fail(): never {
    throw new LiveAiNotConfiguredError();
  }
  answerDoubt(): never { return this.fail(); }
  interpretHandwriting(): never { return this.fail(); }
  diagnose(): never { return this.fail(); }
  createSupport(): never { return this.fail(); }
  createReassessment(): never { return this.fail(); }
  createHomework(): never { return this.fail(); }
}

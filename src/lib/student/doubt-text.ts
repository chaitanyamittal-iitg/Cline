// Wording for the doubt step. Pure and client-safe. This is interface text only: it contains no assessment question.

/** Lower-cases the first letter of a concept title so it reads naturally inside a sentence. */
function inSentence(title: string): string {
  const trimmed = title.trim();
  return trimmed.length === 0 ? "this concept" : trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/** For "Complete circuits" this is exactly: "What is still unclear about complete circuits? You can ask about the battery, wires, bulb or switch." */
export function doubtPrompt(conceptTitle: string): string {
  return `What is still unclear about ${inSentence(conceptTitle)}? You can ask about the battery, wires, bulb or switch.`;
}

/** Label of the option that skips the doubts and opens the written micro-test. */
export const SKIP_DOUBTS_LABEL = "I have no doubts \u2014 start the micro-test";

"use client";
// Shared submit logic for every teacher-action form. TEACHER-OWNED. Client only; imports nothing server-only.
// - One request at a time: a second submit while pending is ignored (and the button is disabled by the form).
// - Never retries automatically, never fakes success, never shows a response body that was not JSON.
// - Form input is owned by the form component, so it is preserved on every error.
// - After a CONFIRMED success only, it refreshes the server data (router.refresh()).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeacherActionInput } from "@/lib/contracts";
import { NETWORK_MESSAGE, classifyResponse, type ActionOutcome } from "@/lib/teacher/action-response";

export const ACTION_ENDPOINT = "/api/teacher/action";

export function useActionSubmit() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<(ActionOutcome & { action: string }) | null>(null);

  async function submit(input: TeacherActionInput): Promise<ActionOutcome | null> {
    if (inFlight.current) return null; // repeated submission while pending is ignored
    inFlight.current = true;
    setPending(true);
    setOutcome(null);

    let result: ActionOutcome;
    try {
      const response = await fetch(ACTION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(input),
        credentials: "same-origin",
        cache: "no-store",
      });
      result = await classifyResponse(response);
    } catch {
      result = { kind: "unexpected", message: NETWORK_MESSAGE };
    }

    setOutcome({ ...result, action: input.action });
    inFlight.current = false;
    setPending(false);
    // Only a confirmed, valid success refreshes the page data. Nothing is shown as saved before this point.
    if (result.kind === "saved") router.refresh();
    return result;
  }

  return { submit, pending, outcome, clearOutcome: () => setOutcome(null) };
}

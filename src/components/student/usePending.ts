"use client";

// Runs one async task at a time. A second call while one is running is ignored, so a double tap or a slow
// connection can never send the same request twice. `pending` drives disabled buttons and status text.
import { useCallback, useRef, useState } from "react";

export function usePending() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    try {
      return await task();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}

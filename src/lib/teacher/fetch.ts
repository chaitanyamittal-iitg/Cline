// Read-only query runner for the teacher pages. TEACHER-OWNED. Server only.
// - Every query runs through the teacher's own session client, so RLS decides which rows come back.
// - A failed query becomes a visible { ok: false } result. It is never converted into an empty list.
// - Raw database errors and stack traces stay in the server log (code only) and out of the UI.
// - Next.js control-flow errors (redirect(), notFound(), request-time APIs) are rethrown, never swallowed.
import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { SectionResult } from "./types";

interface QueryResponse {
  data: unknown;
  error: { code?: string } | null;
}

function failure(what: string): { ok: false; message: string } {
  return { ok: false, message: `${what} could not be loaded. Reload the page to try again.` };
}

export async function fetchRows<S extends z.ZodType>(
  what: string,
  schema: S,
  request: () => PromiseLike<QueryResponse>,
): Promise<SectionResult<z.infer<S>[]>> {
  try {
    const { data, error } = await request();
    if (error) {
      console.error(`[teacher] query failed: ${what} (code ${error.code ?? "none"})`);
      return failure(what);
    }
    if (!Array.isArray(data)) {
      console.error(`[teacher] query returned no row list: ${what}`);
      return failure(what);
    }
    const rows: z.infer<S>[] = [];
    for (const row of data) {
      const parsed = schema.safeParse(row);
      if (!parsed.success) {
        console.error(`[teacher] unexpected row shape: ${what}`);
        return failure(what);
      }
      rows.push(parsed.data);
    }
    return { ok: true, data: rows };
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[teacher] query threw: ${what}`);
    return failure(what);
  }
}

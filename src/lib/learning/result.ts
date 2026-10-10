// Result shape shared by the learning services and the API routes. Pure: no server imports, safe to unit-test.
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
export const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error });

/** Plain-English, safe to show a student. Never contains a stack trace, key or SQL. */
export const SAVE_FAILED = "We could not save that just now. Nothing was changed. Please try again in a moment.";
export const AI_UNAVAILABLE = "The AI helper is not available right now, so nothing was saved. Please try again in a moment.";

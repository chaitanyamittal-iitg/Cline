// Diagnoses "fetch failed" from Node to Supabase. Sends NO key and NO credentials: it only asks the public auth health
// URL and prints the status or the low-level error code (e.g. ENOTFOUND, ETIMEDOUT, ECONNRESET, UND_ERR_CONNECT_TIMEOUT).
const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!raw) {
  console.log("[FAIL] NEXT_PUBLIC_SUPABASE_URL is not set.");
  process.exit(1);
}
const url = `${raw.replace(/\/$/, "")}/auth/v1/health`;

async function once(n: number) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    console.log(`try ${n}: HTTP ${res.status} in ${Date.now() - started} ms`);
  } catch (e) {
    const err = e as { message?: string; cause?: { code?: string; message?: string } };
    console.log(`try ${n}: ${err.message} | cause=${err.cause?.code ?? "?"} ${err.cause?.message ?? ""} in ${Date.now() - started} ms`);
  }
}

async function main() {
  for (let i = 1; i <= 5; i++) {
    await once(i);
    await new Promise((r) => setTimeout(r, 1500));
  }
}
void main();

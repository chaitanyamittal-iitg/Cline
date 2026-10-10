// Reads the Supabase settings from environment variables. LEAD-OWNED.
//
// Supabase renamed its keys: "anon" is now the PUBLISHABLE key and "service_role" is now the SECRET key.
// We prefer the new names and still accept the old ones so an older project keeps working.
// Use static `process.env.NAME` references (not dynamic lookups) so Next.js can find them.

export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

/** Safe for browsers. Row-level security and grants decide what it can reach. */
export function supabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || // legacy name
    undefined
  );
}

/** SERVER ONLY. Bypasses row-level security. Never import this into a client component. */
export function supabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY || // legacy name
    undefined
  );
}

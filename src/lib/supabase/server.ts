// Supabase clients for server code. LEAD-OWNED.
//  - createSupabaseServerClient(): acts as the LOGGED-IN user, so row-level security applies.
//  - createSupabaseAdminClient():  service-role key, BYPASSES security rules. Server-only, use sparingly,
//    and only after you have checked who the logged-in user is.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseSecretKey, supabaseUrl } from "@/lib/env";

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl()!,
    supabasePublishableKey()!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only. The proxy refreshes them.
          }
        },
      },
    },
  );
}

export function createSupabaseAdminClient() {
  const key = supabaseSecretKey();
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set (server only).");
  return createClient(supabaseUrl()!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

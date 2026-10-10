// Next.js 16 "proxy" (formerly middleware). LEAD-OWNED.
// Job: refresh the Supabase login cookie and send logged-out visitors to /login.
// The role check (student vs teacher) happens in src/lib/auth.ts, because it needs a database read.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const url = supabaseUrl();
  const anon = supabasePublishableKey();
  // No Supabase configured yet: let pages render their "setup needed" message.
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/student") || path.startsWith("/teacher");
  if (isProtected && !data.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|diagrams/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

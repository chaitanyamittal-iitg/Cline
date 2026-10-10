// Role guards for server components and actions. LEAD-OWNED.
// The proxy handles the cheap redirect; these re-check on the server because the proxy is not a security boundary.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type Role = "student" | "teacher";
export interface CurrentUser {
  id: string;
  role: Role;
  displayName: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Reading cookies first marks every page that checks the user as per-request (never prerendered),
  // even when Supabase is not configured yet.
  await cookies();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", auth.user.id)
    .single();
  if (!profile) return null;
  return { id: auth.user.id, role: profile.role as Role, displayName: profile.display_name };
}

export function homeFor(role: Role): string {
  return role === "teacher" ? "/teacher" : "/student";
}

/** Use at the top of any /student page or action. Teachers are sent to their own area. */
export async function requireStudent(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect(homeFor(user.role));
  return user;
}

/** Use at the top of any /teacher page or action. Students are sent to their own area. */
export async function requireTeacher(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect(homeFor(user.role));
  return user;
}

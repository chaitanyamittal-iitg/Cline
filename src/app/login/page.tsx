import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="container" style={{ maxWidth: 440 }}>
      <h1>SAFAL</h1>
      <p className="muted">Sign in with the account your school gave you.</p>
      {!isSupabaseConfigured() && (
        <p className="notice">
          Setup needed: Supabase is not configured yet. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and fill in the Supabase values (see README).
        </p>
      )}
      <LoginForm />
      <p className="muted">Demo uses fictional accounts only.</p>
    </main>
  );
}

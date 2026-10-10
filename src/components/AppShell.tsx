// Shared page frame: header, role-aware nav, AI badge. LEAD-OWNED.
import Link from "next/link";
import { getAiProvider } from "@/lib/ai";
import type { CurrentUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export function AiBadge() {
  const ai = getAiProvider();
  return (
    <span className={`badge ${ai.source === "mock" ? "badge-mock" : "badge-live"}`} title="Which AI is producing tutor output">
      {ai.label}
    </span>
  );
}

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const home = user.role === "teacher" ? "/teacher" : "/student";
  return (
    <>
      <header className="shell-header">
        <Link href={home} className="brand">SAFAL</Link>
        <nav className="shell-nav" aria-label="Main">
          <Link href={home}>{user.role === "teacher" ? "Class dashboard" : "My learning"}</Link>
          {user.role === "student" && <Link href="/student/homework">Homework</Link>}
        </nav>
        <div className="shell-user">
          <AiBadge />
          <span>{user.displayName} ({user.role})</span>
          <form action={signOut}>
            <button className="btn btn-secondary" type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}

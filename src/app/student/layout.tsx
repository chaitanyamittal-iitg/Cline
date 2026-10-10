// Student area frame. LEAD-OWNED. Individual student pages below this are owned by the Student teammate.
import { AppShell } from "@/components/AppShell";
import { requireStudent } from "@/lib/auth";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  return <AppShell user={user}>{children}</AppShell>;
}

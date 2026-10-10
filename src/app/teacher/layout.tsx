// Teacher area frame. LEAD-OWNED. Individual teacher pages below this are owned by the Teacher teammate.
import { AppShell } from "@/components/AppShell";
import { requireTeacher } from "@/lib/auth";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTeacher();
  return <AppShell user={user}>{children}</AppShell>;
}

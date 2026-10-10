"use client";
// Re-runs the current server page so its data (and any signed image links) are requested again. TEACHER-OWNED.
// Navigation/reload only: it changes no data. Imports nothing server-only.
import { useRouter } from "next/navigation";

export function ReloadButton({ label = "Reload this page" }: { label?: string }) {
  const router = useRouter();
  return (
    <button type="button" className="btn btn-secondary" onClick={() => router.refresh()}>
      {label}
    </button>
  );
}

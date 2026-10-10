// Visible failure for one section. TEACHER-OWNED. The message is already user-safe (no raw database error).
export function SectionError({ message }: { message: string }) {
  return (
    <p className="error" role="alert">
      {message}
    </p>
  );
}

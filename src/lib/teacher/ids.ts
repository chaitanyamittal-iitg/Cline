// Route-id validation for /teacher/students/[studentId]. TEACHER-OWNED. Pure (unit-tested in ids.test.ts).
// profiles.id is a uuid. Checking the shape first means a malformed URL never reaches the database.

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isStudentIdFormat(value: string): boolean {
  return UUID_SHAPE.test(value);
}

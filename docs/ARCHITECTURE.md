# SAFAL architecture (Round 2 prototype)

Product source of truth: `Tech Doc - Team skill issue.pdf`. This file explains how the code is organised.

## The big picture

One Next.js (App Router, TypeScript) web app with two areas:

- `/student/*` for the two fictional students (classroom tablet or home).
- `/teacher/*` for the one fictional teacher.

Supabase provides login (Auth), the PostgreSQL database and private file storage.
The AI sits behind a server-side interface, so the app never depends on one model vendor.

```
Browser ──> Next.js pages / server actions ──> Supabase (Auth, Postgres, private Storage)
                         │
                         └──> AiProvider interface ──> MockAiProvider (dev)  |  LiveAiProvider (real model)
```

## Key decisions (plain language)

| Decision | Why |
|---|---|
| Zod schemas in `src/lib/contracts` | One definition of every request/response. TypeScript types come from it, so teammates cannot drift apart. |
| `AiProvider` interface + `MockAiProvider` | Everyone can build and test the whole flow without an API key. Mock output is always labelled "MOCK AI". |
| Server writes learning state | Students cannot edit their own progress or diagnoses from the browser. The server uses the service-role key after checking who is logged in. |
| Row-level security (RLS) | Even if code has a bug, a student can only read their own rows. The teacher can read the fictional class. |
| Explicit GRANTs on every table | The Supabase project has automatic table exposure OFF, so a new table is invisible to the API until granted. Logged-out `anon` gets nothing; logged-in users get SELECT (plus INSERT on `teacher_actions` only); the server role gets only what it needs. GRANT decides *what statements*, RLS decides *which rows*. Both are required. |
| Answer keys in a separate table | `question_keys` is readable by the teacher only, so students cannot fetch answers. |
| Private storage bucket `student-work` | Handwritten uploads are never public. Files live in `<student_id>/...`. |
| `proxy.ts` plus server role guards | The proxy refreshes login cookies and redirects logged-out visitors. `requireStudent()` / `requireTeacher()` do the real role check. |
| Cache Components off | Pages are per-student and read cookies on every request. Turning it on adds complexity we do not need. |
| No numerical scores | Each answer is right/wrong only (tech doc rule). There is no score column anywhere. |

## Learning state machine (per student, per concept)

```
lesson -> doubts -> microtest -> analysis -> passed
                                    |
                                    v
                         support -> reassessment   (cycle 1)
                                    |  still struggling
                                    v
                         support -> reassessment   (cycle 2)
                                    |  still struggling
                                    v
                              teacher_flagged
```

- At most **two** support/reassessment cycles. The cap is enforced in server code and by a database constraint.
- `passed` never moves the student on by itself. Only the teacher sets `teacher_cleared_to_next`.

## Folder map

```
src/app/login            login page + server actions        (lead)
src/app/student/**       student screens                    (Student teammate)
src/app/teacher/**       teacher screens                    (Teacher teammate)
src/app/api/**           route handlers (answers, tutor...) (see docs/TASKS.md)
src/components           shared UI (AppShell)               (lead)
src/lib/contracts        shared types + schemas             (lead only)
src/lib/learning         state machine + persistence        (AI and backend: the ONLY place that writes learning state)
src/lib/ai               AiProvider, mock, live stub        (lead: interface; AI teammate: live.ts)
src/lib/supabase         Supabase clients                   (lead)
src/lib/auth.ts          role guards                        (lead)
src/proxy.ts             login-cookie refresh + redirect    (lead)
supabase/migrations      database schema + RLS              (lead only)
supabase/seed            4-concept content (draft)          (lead; teacher to review)
scripts/seed-users.ts    fictional demo accounts + reset    (lead)
docs                     these documents
```

## Security rules (from the tech doc)

- Only fictional student data. No real names, photos or schoolwork in the repo.
- `SUPABASE_SECRET_KEY` (the new name for service_role) and `AI_API_KEY` are server-only. Never prefix them with `NEXT_PUBLIC_`.
- Supabase renamed its keys: anon is now the **publishable** key, service_role is now the **secret** key. `src/lib/env.ts` reads the new names and still accepts the old ones.
- The tutor, generated questions and visuals may only use resources where `approved = true`.

## Demo accounts (fictional)

| Email | Role |
|---|---|
| `teacher@safal.demo` | teacher |
| `student.a@safal.demo` | student |
| `student.b@safal.demo` | student |

Passwords come from `.env.local` (`DEMO_*_PASSWORD`) and are never committed.

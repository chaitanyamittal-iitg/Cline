# SAFAL: Software with integrated AI for Adaptive Learning

Built by **Team Skill Issue** for the Cline AI Builder Hackathon (Round 2).

> Status: foundation milestone. The full learning flow is still being built. See "What works today" below.

## Problem

In a normal class every student gets the same explanation at the same speed. Students who misunderstand an idea
are often not noticed until an exam, and teachers cannot give everyone one-to-one attention.

## Solution

SAFAL is a web portal where every student studies the same curriculum but is supported individually. For one
Classes 6-8 science unit (electricity and circuits, four concepts) it runs this loop:

1. Shared recorded lesson and reading.
2. Doubt discussion with a tutor that only uses teacher-approved diagrams, graphics and videos.
3. A predefined written micro-test (typed answers or an uploaded photo of handwritten work).
4. AI analysis of the answer **and the reasoning**, including correct answers with faulty reasoning. Right/wrong only; no scores.
5. Targeted support, then a personalised reassessment. At most two cycles, then the teacher is flagged.
6. The teacher decides when a student moves on. Personalised homework can be done from home.

## What works today

- Next.js app with login, student/teacher route separation and a shared responsive layout.
- Database schema, security rules, private upload bucket and draft four-concept seed content.
- Shared TypeScript contracts and an AI interface with a clearly labelled **MOCK AI** (no live AI yet).
- Lesson, doubts, micro-test, diagnosis, homework and dashboard screens: **not built yet**.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/CONTRACTS.md](docs/CONTRACTS.md) and [docs/TASKS.md](docs/TASKS.md).

## Tech stack

Next.js 16 (App Router) and TypeScript; Supabase (PostgreSQL, Auth, private Storage); Zod for shared contracts;
Vitest for tests; a server-side, swappable AI provider interface (mock now, live later).

## Setup

Requirements: Git, Node.js 24 LTS (with npm).

```
git clone https://github.com/chaitanyamittal-iitg/Cline.git
cd Cline
npm install
copy .env.example .env.local      # Windows. On Mac/Linux: cp .env.example .env.local
```

1. Create a free project at https://supabase.com.
2. Fill `.env.local` (copy of `.env.example`). Where each value lives in Supabase:
   | Variable in `.env.local` | Supabase dashboard location | Safe for browsers? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Click **Connect** at the top, **API** tab (Project URL) | yes |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Project Settings > API Keys**, "Publishable key" (`sb_publishable_...`) | yes |
   | `SUPABASE_SECRET_KEY` | **Project Settings > API Keys**, "Secret keys" (`sb_secret_...`) | **no, server only** |
   | `DEMO_*_PASSWORD` (3 of them) | You invent them (8+ characters, not a real password) | n/a |

   Never paste keys into chat, screenshots or Git. Then run `npm run env:check`: it reports set/missing and
   whether each value looks right, without printing any secret. Later, `npm run env:check:live` also confirms the
   database tables and seed content exist.
3. In **SQL Editor** run, in this order: `supabase/migrations/0001_core.sql`, `0002_learning_state.sql`,
   `0003_homework_teacher.sql`, `0004_policies_storage.sql`, `0005_homework_diagnosis_and_generated_keys.sql`, then
   `supabase/seed/content_1_concepts_resources.sql` and `content_2_questions.sql`.
   This project expects Supabase settings: Data API **on**, automatic table exposure **off**, automatic RLS **on**.
   The migrations therefore contain explicit least-privilege `GRANT`s next to the RLS policies.
4. (Recommended) Run `supabase/verify_security_summary.sql` in the SQL Editor. It only reads. Expected: 14 rows, all
   `PASS`. (`supabase/verify_security.sql` lists the raw grants and policies if you want to look closer.)
5. Choose passwords for the three fictional accounts in `.env.local` (`DEMO_*_PASSWORD`), then run `npm run seed:users`.
6. Run `npm run verify:rls`. It signs in as each fictional account (publishable key only, nothing is changed) and
   checks that students only see their own data, answer keys are hidden, and logged-out visitors get nothing.
   Every line should say `[PASS]`.
7. `npm run dev` and open http://localhost:3000.

Demo accounts: `teacher@safal.demo`, `student.a@safal.demo`, `student.b@safal.demo` (fictional).

Useful commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run check` (all four).

AI mode: `AI_PROVIDER=mock` (default) shows a "MOCK AI" badge everywhere. Mock output is rule-based and is not real AI.

## How Cline contributed

Cline was the development tool for this project: it inspected the repository, installed tooling, scaffolded the
app, wrote the schema, contracts, AI interface and docs, and ran checks. A factual record is in
[docs/BUILD_LOG.md](docs/BUILD_LOG.md). The AI model used inside SAFAL is separate from the model Cline uses to write code.

## Team workflow

Each teammate works on their own branch in their own clone. See [docs/TASKS.md](docs/TASKS.md).

## Data and safety

Only fictional student data is used. API keys and privileged database access stay on the server.

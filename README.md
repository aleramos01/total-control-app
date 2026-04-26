# Total Control App

Stack:

- `Front-end/`: React + Vite + TypeScript
- `backend/`: Fastify + TypeScript + Postgres
- `supabase/`: migrations and Edge Functions for the production cutover
- `docs/`: launch and operation checklists

This repository now carries both the legacy backend and the Supabase-first production path for the MVP.

## Current architecture

- Production target: `Front-end` on Vercel
- Runtime backend target: Supabase Auth + Postgres + Edge Functions
- Legacy backend: kept in the repository as fallback/reference during the transition

## Local development

### Frontend with Supabase

1. `cd Front-end`
2. `cp .env.example .env`
3. Fill:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. `npm install`
5. `npm run dev`

### Legacy backend with local Postgres

1. `docker compose up -d`
2. Wait for the `postgres` container to become healthy
3. `cd backend`
4. `cp .env.example .env`
5. Set `SESSION_SECRET`
6. Keep `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/total_control`
7. `npm install`
8. `npm run db:migrate`
9. `npm run db:seed-demo`
10. `npm run dev`

## Supabase production path

### Frontend on Vercel

- Project root: `Front-end`
- Node version: `20.x`
- Build command: `npm run build`
- Output directory: `dist`
- Required env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### Supabase project

- Apply the SQL in `supabase/migrations/`
- Deploy the functions in `supabase/functions/`
- Configure the function secret:
  - `SUPABASE_SERVICE_ROLE_KEY`

### Main Supabase functions

- `register-public`: public signup, with first user promoted to admin
- `register-with-invite`: invite-based signup for controlled onboarding
- `create-invite`: admin invite generation
- `import-data`: categories and transactions import flow

## Authentication behavior

- Public signup is enabled in the frontend
- The first registered user becomes the initial admin
- Later public signups create regular users
- Invites remain available for admin-controlled onboarding

## Test and verification

- Frontend tests: `npm --prefix Front-end run test`
- Frontend build: `npm --prefix Front-end run build`
- Workspace build: `npm run build`

Notes:

- `npm run verify` still executes legacy backend tests that require a running Postgres instance on `127.0.0.1:5432`
- The Supabase migration assets in this repository do not automatically provision your cloud project

## Launch docs

- MVP launch checklist: `docs/mvp-launch-checklist.md`
- Supabase setup details: `supabase/README.md`

## Security

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend
- Keep `VITE_SUPABASE_ANON_KEY` only in Vercel environment settings
- Rotate any leaked database credentials before production rollout

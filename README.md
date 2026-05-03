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

There are two valid local flows in this repository:

- `Frontend + local Supabase`: matches the current app architecture
- `Legacy backend + local Postgres`: useful for API fallback, backend tests and schema/reference work

Recommended order:

1. Bring up the legacy backend once to validate local Docker/Postgres and backend tests.
2. Bring up the local Supabase stack and run the current frontend against it.

### Prerequisites

- Node `20.x`
- Docker + Docker Compose
- Supabase CLI via `npx supabase ...` or a local/global install

## Phase 1: legacy backend with local Postgres

1. Install packages:
   - `npm run setup`
2. Start Postgres:
   - `npm run docker:up`
3. Create the backend env file:
   - `cp backend/.env.example backend/.env`
4. Edit `backend/.env`:
   - set `SESSION_SECRET`
   - keep `PORT=4000`
   - keep `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/total_control`
   - keep `APP_BASE_URL=http://127.0.0.1:3000`
5. Apply schema and demo data:
   - `npm run back:bootstrap`
6. Start the backend:
   - `npm run dev:back`

Verification:

- API should start on `http://127.0.0.1:4000`
- backend tests should work with `npm run test:back`

## Phase 2: frontend with local Supabase

This is the current product path. The frontend does not use the Fastify backend; it uses Supabase Auth, Postgres and Edge Functions directly.

1. Start the local Supabase stack:
   - `npm run supabase:start`
2. Generate `Front-end/.env.local` from the running stack:
   - `npm run supabase:env`
3. Start the frontend:
   - `npm run dev:front`

What `npm run supabase:env` does:

- reads the running local Supabase connection data from `supabase status -o env`
- writes `Front-end/.env.local` with:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Verification:

- frontend should start on `http://127.0.0.1:3000`
- the first public signup becomes admin
- later public signups are blocked and must use an admin invite
- Edge Functions are available through the local Supabase API gateway

### Useful local commands

- `npm run supabase:status`
- `npm run supabase:reset`
- `npm run supabase:stop`
- `npm run docker:logs`

## Supabase production path

### Frontend on Vercel

- Project root: `Front-end`
- Production URL: `https://total-control-app.vercel.app`
- Node version: `20.x`
- Build command: `npm run build`
- Output directory: `dist`
- Required env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### Supabase project

- Apply the SQL in `supabase/migrations/`
- Deploy the functions in `supabase/functions/`
- Set Auth `Site URL` to `https://total-control-app.vercel.app`
- Add redirect URLs for Vercel previews plus local development URLs
- Configure the function secret:
  - `SUPABASE_SERVICE_ROLE_KEY`

### Main Supabase functions

- `auth-status`: public onboarding status for the auth screen
- `register-public`: bootstrap-only signup, with the first user promoted to admin
- `register-with-invite`: invite-based signup for controlled onboarding
- `create-invite`: admin invite generation
- `import-data`: categories and transactions import flow

## Authentication behavior

- Public signup is exposed only while the project has no users
- The first registered user becomes the initial admin
- Later public signups are rejected
- Invites are the default onboarding path after bootstrap

## Test and verification

- Frontend tests: `npm --prefix Front-end run test`
- Frontend build: `npm --prefix Front-end run build`
- Workspace build: `npm run build`
- Backend tests with local Postgres: `npm run test:back`

Notes:

- `npm run verify` still executes legacy backend tests that require a running Postgres instance on `127.0.0.1:5432`
- the local Supabase setup now depends on `supabase/config.toml`
- the Supabase migration assets in this repository do not automatically provision your cloud project

## Launch docs

- MVP launch checklist: `docs/mvp-launch-checklist.md`
- Supabase setup details: `supabase/README.md`

## Security

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend
- Keep `VITE_SUPABASE_ANON_KEY` only in Vercel environment settings
- Rotate any leaked database credentials before production rollout

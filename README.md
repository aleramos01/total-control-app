# Total Control App

Stack:

- `Front-end/`: React + Vite + TypeScript
- `backend/`: Fastify + TypeScript + Postgres
- `supabase/`: migrations and Edge Functions for the Supabase cutover

This repository now carries both the legacy backend and the new Supabase-first migration path for the frontend.

## Run locally

### Frontend with Supabase

1. `cd Front-end`
2. `cp .env.example .env`
3. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
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

## Supabase deployment

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

### Main migration assets

- `supabase/functions/register-with-invite`: invite-based signup and first-admin bootstrap
- `supabase/functions/create-invite`: admin invite generation
- `supabase/functions/import-data`: import pipeline for categories and transactions

## Test and verification

- Frontend tests: `npm --prefix Front-end run test`
- Frontend build: `npm --prefix Front-end run build`
- Workspace build: `npm run build`

Notes:

- `npm run verify` still exercises the legacy backend tests, which require a running Postgres instance on `127.0.0.1:5432`.
- The Supabase migration work in this repository does not automatically provision or deploy your Supabase project.

## Security

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend
- Keep `VITE_SUPABASE_ANON_KEY` only in the Vercel frontend env settings
- Rotate any leaked database credentials before production rollout

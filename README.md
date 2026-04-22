# Total Control App

Stack:

- `Front-end/`: React + Vite + TypeScript
- `backend/`: Fastify + TypeScript + Postgres

This repository is the main product line of Total Control. It contains the current frontend and backend, authentication, settings, import/export, tests, and the mobile-first dark UI work.

## Run locally

### Backend

1. `cd backend`
2. `cp .env.example .env`
3. Defina `SESSION_SECRET`
4. Defina `DATABASE_URL` para um Postgres válido
4. `npm install`
5. `npm run dev`

### Frontend

1. `cd Front-end`
2. `cp .env.example .env`
3. `npm install`
4. `npm run dev`

## Repository Intent

- Main application repository
- Current product state with backend and frontend together
- Recommended GitHub repository name: `total-control-app`

## Deploy split

- `Front-end/`: deploy recomendado na Vercel
- `backend/`: deploy separado da Vercel nesta fase

### Vercel frontend settings

- Project root: `Front-end`
- Node version: `20.x`
- Build command: `npm run build`
- Output directory: `dist`
- Required env var: `VITE_API_BASE_URL`

### Free-tier deploy recommendation

- Frontend: Vercel
- Backend app: Render Free Web Service
- Database: Supabase Free Postgres

Required backend env vars:

- `NODE_ENV=production`
- `SESSION_SECRET=<strong-random-secret>`
- `DATABASE_URL=<supabase-postgres-connection-string>`
- `CORS_ORIGIN=https://<your-frontend>.vercel.app`
- `APP_BASE_URL=https://<your-frontend>.vercel.app`

Deploy order:

1. Create a Supabase project and copy the Postgres connection string.
2. Deploy `backend/` as a Render Free Web Service.
3. Set the backend env vars, especially `DATABASE_URL`.
4. Confirm `https://<your-backend>/health` returns `{ "status": "ok" }`.
5. Set `VITE_API_BASE_URL` in the Vercel frontend project.
6. Redeploy the frontend on Vercel.

Notes:

- The backend now uses Postgres and no longer depends on a local SQLite volume.
- A free backend may cold start after inactivity; this is acceptable for the current low-cost target.

## Versioning

- Current MVP baseline: `0.1.0`
- Commit style: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`)
- Semantic versioning: `MAJOR.MINOR.PATCH`

## Test and verification

- Run all unit tests: `npm run test`
- Run all builds: `npm run build`
- Run release gate: `npm run verify`

Unit coverage intentionally focuses on stable, low-flake logic:

- backend utility functions
- backend payload validators
- category key normalization
- frontend transaction query serialization
- frontend CSV generation
- frontend recurring-bill derivation

## Current limitations of the automated tests

- They do not cover full browser interaction flows.
- They do not replace manual smoke validation of login, create transaction and brand settings.
- They do not exercise a production Postgres instance under concurrent load.
- They do not validate CSS/layout regressions.
- They are designed to be fast and safe for CI/build, not exhaustive end-to-end coverage.

Minimum pre-deploy check:

1. `npm run verify`
2. Start backend and frontend locally
3. Validate register/login
4. Create, edit and delete a transaction
5. Validate brand settings save and reload
6. Confirm the deployed backend reads/writes to Postgres successfully

## Security defaults

- Passwords hashed with `argon2`
- Session cookie uses `httpOnly`, `SameSite=None` in production and `SameSite=Lax` outside production
- No API secrets exposed in the frontend
- Financial data persisted in SQLite, not browser storage
- Recommended production runtime: Node `20+`

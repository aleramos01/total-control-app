## Supabase

Local structure for the Total Control production backend on Supabase.

## Local development

This repository now includes `supabase/config.toml` so the CLI can boot a local stack directly from the checked-in migration and functions.

### Start the local stack

From the repository root:

`npm run supabase:start`

### Reset the local database

`npm run supabase:reset`

### Stop the local stack

`npm run supabase:stop`

### Frontend env sync

After the local stack is running:

`npm run supabase:env`

This writes `Front-end/.env.local` using the local API URL and anon key exposed by `supabase status -o env`.

### What exists here

- `migrations/`: schema, seeds and RLS policies
- `functions/auth-status`: public onboarding status for the auth screen
- `functions/register-public`: bootstrap-only signup for the first admin
- `functions/register-with-invite`: invite-based signup
- `functions/create-invite`: admin invite creation
- `functions/import-data`: categories and transactions import pipeline

### Required secrets in Edge Functions

- `SUPABASE_SERVICE_ROLE_KEY`

For local CLI development, Supabase provides the standard function secrets automatically, including `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Frontend environment variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Recommended dashboard order

1. Create or open the final Supabase project
2. Apply the SQL migration in `migrations/`
3. Deploy all functions in `functions/`
4. Configure `SUPABASE_SERVICE_ROLE_KEY`
5. In Auth URL configuration, set `Site URL` to `https://total-control-app.vercel.app`
6. Add redirect URLs for:
   - `https://total-control-app.vercel.app/**`
   - `https://*-total-control-app.vercel.app/**`
   - `http://127.0.0.1:3000/**`
   - `http://localhost:3000/**`
7. Configure Vercel with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Auth rules expected by the app

- First public signup becomes admin
- Later public signups are blocked
- Invite signups become the standard onboarding flow after bootstrap

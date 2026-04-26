## Supabase

Local structure for the Total Control production backend on Supabase.

### What exists here

- `migrations/`: schema, seeds and RLS policies
- `functions/register-public`: public signup and first-admin bootstrap
- `functions/register-with-invite`: invite-based signup
- `functions/create-invite`: admin invite creation
- `functions/import-data`: categories and transactions import pipeline

### Required secrets in Edge Functions

- `SUPABASE_SERVICE_ROLE_KEY`

### Frontend environment variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Recommended dashboard order

1. Create or open the final Supabase project
2. Apply the SQL migration in `migrations/`
3. Deploy all functions in `functions/`
4. Configure `SUPABASE_SERVICE_ROLE_KEY`
5. Review Auth settings and allowed URLs
6. Configure Vercel with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Auth rules expected by the app

- First public signup becomes admin
- Later public signups become regular users
- Invite signups remain available and also create regular users unless the system has no users yet

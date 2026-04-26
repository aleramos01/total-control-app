# MVP Launch Checklist

## 1. Security first

- Rotate any database credential that has been exposed
- Confirm `.env` files are not committed
- Confirm only `.env.example` files remain in the repository

## 2. Supabase dashboard

- Open the final Supabase project
- Apply `supabase/migrations/20260425190000_init_total_control.sql`
- Deploy the functions:
  - `register-public`
  - `register-with-invite`
  - `create-invite`
  - `import-data`
- Configure the secret:
  - `SUPABASE_SERVICE_ROLE_KEY`
- Review Auth settings:
  - site URL
  - redirect URLs
  - public signup enabled

## 3. Vercel dashboard

- Keep `Front-end` as the project root
- Set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Trigger a redeploy

## 4. Smoke test in production

- Open `https://total-control-app.vercel.app`
- Create the first account and confirm it becomes admin
- Log out and log back in
- Create one public non-admin account
- Create an invite from the admin account
- Register one account using the invite flow
- Create, edit and delete a transaction
- Create an installment transaction and confirm the series
- Create and delete a custom category
- Save brand settings and app settings
- Export JSON
- Import JSON

## 5. Support checklist

- Admin bootstrap:
  first public signup becomes admin
- Invite flow:
  admin creates the invite from the account tools area
- Branding:
  admin updates product name, colors, logo and support email
- Settings:
  admin updates locale, currency, timezone and billing day
- Import validation:
  confirm imported categories and transactions appear only for the authenticated user

## 6. Release acceptance

- Frontend published on Vercel with the real Supabase project
- First admin created successfully
- At least one regular user created successfully
- Core financial flows validated end-to-end
- No secret values exposed in the repository or frontend bundle

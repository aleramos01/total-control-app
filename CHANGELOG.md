# Changelog

## 0.1.0

- Added Fastify + SQLite backend with secure cookie sessions.
- Removed Gemini-based AI features from the frontend.
- Added real authentication, transaction persistence and brand settings.
- Refreshed the UI for a lighter commercial/white-label presentation.

## 0.2.0

- Split fast local validation from the full legacy backend validation path.
- Added explicit Postgres preflight checks for backend integration tests.
- Added a production smoke script for the live Vercel + Supabase deployment.
- Improved frontend empty, retry and startup error states.
- Consolidated release, validation and roadmap documentation around the official production path.

## 0.3.0

- Added active filter chips, selection mode and bulk actions for transaction lists.
- Added installment series editing with explicit scope selection for single-item versus full-series updates.
- Added a JSON import preview modal so users can review categories and transactions before persisting them.
- Improved CSV exports with filtered visible transactions, stable filenames, formatted dates and full transaction metadata.
- Added progressive rendering for large monthly transaction groups.
- Added bank statement CSV import with mandatory reconciliation preview, safe transaction updates and new transaction creation.

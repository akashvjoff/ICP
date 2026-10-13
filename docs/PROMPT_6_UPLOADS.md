# Prompt 6: CSV/XLSX lead uploads

## What is implemented

The existing four-step upload wizard now accepts `.csv` and `.xlsx` files up to 5 MB by click or drag-and-drop. It parses the first worksheet only, suggests common column mappings, prevents a source column from being mapped twice, previews the first 10 records, validates every parsed row, and shows valid, invalid, duplicate, and missing-value totals.

Exact normalized-domain duplicates can be skipped. Exact-name matches with different domains are only flagged for review and are not merged. Blank numeric values remain `null`, zero remains zero, and invalid numeric input is stored as blank with a validation warning. At most 500 valid records are stored. Up to 100 distinct stored records are marked `analysis_eligible`; no AI API is called by this workflow.

In live mode the browser sends the original file bytes, selected mapping, and authenticated Supabase access token to `POST /api/uploads`. The server verifies the token, reparses and revalidates the untrusted file, derives ownership only from the verified user, inserts the dataset and leads through the user's RLS-scoped Supabase client, and creates an `analysis_jobs` row with `status = queued`. A failed lead or job insert triggers a best-effort dataset rollback.

Original upload files are not retained. Formula text is never executed, and uploaded row contents are not logged by the upload endpoint.

## Local setup

1. Use a supported current Node.js release and run `npm install`.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is optional for existing administrative endpoints and must never be exposed to the browser.
3. Apply the migrations in `supabase/migrations` in timestamp order. Existing projects only need the new additive migration `20261012000004_upload_metadata_and_normalized_fields.sql` after the earlier migrations.
4. Run `npm run dev`, authenticate, finish seller onboarding, and open **Upload leads**.

Demo mode can still exercise parsing, mapping, validation, and local display without database credentials. Live persistence deliberately returns an actionable error when Supabase or a valid session is unavailable; it does not silently pretend to save.

## Verification commands

```sh
npm run lint
npm test
npm run test:pipeline
npm run build
```

Automated tests use synthetic companies only. Persistence tests exercise the repository boundary and ownership propagation with an in-memory fake. A real Supabase integration run requires project credentials plus applied migrations.

## Relevant files

- `src/pages/UploadWizardPage.tsx` — existing branded wizard and review UI
- `src/lib/leadPipeline.ts` — parsing, mapping suggestions, normalization, validation, and duplicate detection
- `src/server/upload.ts` — server request schema and persistence transaction boundary
- `server.ts` — authenticated upload API route
- `supabase/migrations/20261012000004_upload_metadata_and_normalized_fields.sql` — additive schema changes
- `samples/leads-template.csv` — safe synthetic test file

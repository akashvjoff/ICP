# Prompt 18 — Production acceptance and release hardening

Continue the existing FiguredIt project after Prompt 17 is deployed. Preserve the current product flow, visual design, and the work from Prompts 0–17. Use the existing React, Express, Supabase, and Gemini code rather than rebuilding it.

## Objective

Prove that a real signed-in user can complete the five-step ICP workflow on the deployed free-tier service, and fix any failures found. Keep every finding labelled as an **ICP Hypothesis** unless outcome data supports validation.

## First, establish the release baseline

1. Record the deployed URL, Git commit, Render service status, and Supabase project ref. Do not print credentials.
2. Confirm the migration ledger matches the repository, including `20261013185901_grant_service_role_analysis_tables`.
3. Run `npm run lint`, `npm test`, `npm run test:pipeline`, and `npm run build` from the release commit. Stop on a failed check and report it accurately.

## Acceptance journey

Use synthetic company and lead data only. Test sign-up/sign-in, seller onboarding, CSV/XLSX upload and mapping, company intelligence, resumable analysis, Need Gap and 5C, STP, deterministic scoring, report generation, and export. Refresh or sign out and back in at key steps to confirm database persistence. Record the exact step, response, and visible result for each check.

Verify cross-user isolation with a second synthetic user. Confirm neither user can read or change the other's datasets, leads, analyses, scores, or reports. Check that server secrets never appear in browser responses or bundles. Confirm that missing data remains unknown and AI hypotheses are labelled as such.

Exercise failure states: invalid upload, expired session, unavailable Gemini, rate limit, failed analysis retry, and partial batch completion. Confirm the user sees a clear recovery path and no duplicate records are created.

## Completion criteria

- All acceptance steps pass on the deployed service, or each failure has a reproducible issue and a verified fix.
- Synthetic records and users created for testing are removed and their removal is verified.
- The free-tier service remains healthy; no paid resource is enabled.
- The final report lists the deployed URL and commit, migration status, test evidence, remaining limitations, and next product priorities.

Do not change the design, expose credentials, reset the database, or use real customer data. Review any public deployment or GitHub release action with the project owner before executing it.

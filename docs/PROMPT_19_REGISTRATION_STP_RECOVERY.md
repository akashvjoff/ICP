# Prompt 19 — Registration, live STP persistence, and recovery-state hardening

Continue the deployed FiguredIt application after Prompt 18. Preserve the existing product flow, visual system, React/Express architecture, Supabase workspace isolation, Gemini analysis, and deterministic scoring.

## Objective

Close the remaining production acceptance gaps without introducing paid infrastructure or real customer data.

## Scope

1. Harden email-and-password registration for the hosted Supabase project: normalize email input, use the deployed application origin as the confirmation redirect, keep confirmation enabled, show actionable errors, and support resending confirmation.
2. Load the saved STP analysis for the active signed-in dataset into the shared workspace store so the dashboard restores the segment count and highest-priority segment after refresh or sign-in.
3. Keep demo seller, lead, score, segment, and report content confined to demo mode.
4. Match analysis recovery instructions to the saved state: wait and resume after quota limits, retry failed records, or resume an interrupted batch from its checkpoint.
5. Verify lint, automated tests, upload pipeline checks, production build, Supabase RLS-backed reads, Render health, and the deployed browser flow.

## Completion criteria

- A newly opened registration form contains no demo credentials.
- Signup returns either a confirmation-pending state or a specific actionable error.
- A signed-in dashboard restores saved datasets, scores, and STP segments from Supabase.
- Recovery states preserve completed work and present the correct next action.
- The free-tier deployed service remains healthy.
- Synthetic acceptance data is removed and verified.

Real inbox receipt and confirmation-link delivery require a user-controlled deliverable email address. Do not bypass email confirmation or weaken authentication to automate that inbox step.

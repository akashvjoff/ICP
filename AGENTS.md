# FiguredIt repository guide

FiguredIt (figuredit.in) is a B2B ICP discovery SaaS. It is hosted on Render; the domain is managed on Namecheap.

## Stack and layout
- React + Vite + Tailwind CSS single-page app in `src/`; entry files: `src/main.tsx`, `src/App.tsx`, `src/index.css`.
- Pages and UI: `src/pages/`, `src/components/`; client auth, state, and Supabase access: `src/lib/`.
- Node/Express server and `/api/*` routes: `server.ts`; analysis and provider services: `src/server/`.
- Gemini runs server-side through `@google/genai`; input/output validation uses Zod.
- Supabase Auth (Google OAuth) and Postgres with RLS; schema and migrations: `supabase/schema.sql`, `supabase/migrations/`.
- Supabase tables include `seller_profiles`, `datasets`, `leads`, `company_analyses`, `analysis_jobs`, `segments`, `scoring_configs`, `lead_scores`, and `icp_reports`.
- Configuration examples: `.env.example`; deployment configuration: `render.yaml`.

## Commands
- Development: `npm run dev`.
- Production build: `npm run build`.
- Existing tests: `npm test`.
- Type check: `npm run lint`.

## Working rules
- Find code with `rg` and open only files needed for the task; do not read the whole repo or lockfiles.
- Make the smallest change that works; avoid unrelated refactors.
- Keep the existing visual design and copy tone.
- Enforce security, usage limits, and billing on the server; never trust client-only checks.
- Never commit secrets. Document each new environment variable in `.env.example` with a comment.
- Run the build and existing tests once at the end of code changes.
- Reply in five lines or fewer, covering files changed, new environment variables, and manual dashboard steps for the owner.

# Environment variables

Set production values in Render. Keep secrets out of Git. `VITE_` values are bundled into public JavaScript; the Supabase anon key is intentionally public and relies on RLS. This inventory covers runtime, build, and live-test scripts.

| Variable | Used for | Secret? |
| --- | --- | --- |
| `NODE_ENV` | Production behavior and server-side analytics | No |
| `PORT` | HTTP listen port | No |
| `ALLOW_PRODUCTION_DEMO` | Explicitly allow demo fallback in production | No |
| `APP_URL` | Public base URL for links in completion emails | No |
| `RESEND_API_KEY` | Send analysis completion emails via Resend | Yes |
| `VITE_CONTACT_EMAIL` | Public contact address | No |
| `VITE_BILLING_ENABLED` | Legacy pricing switch; checkout is handled by the server | No |
| `DODO_PAYMENTS_API_KEY` | Dodo Payments server API credential | Yes |
| `DODO_WEBHOOK_SECRET` | Verifies signed Dodo webhook payloads | Yes |
| `DODO_ENVIRONMENT` | `test_mode` or `live_mode` | No |
| `DODO_PRODUCT_STARTER_MONTHLY` | Starter monthly subscription product ID | No |
| `DODO_PRODUCT_STARTER_YEARLY` | Starter annual subscription product ID | No |
| `DODO_PRODUCT_PRO_MONTHLY` | Pro monthly subscription product ID | No |
| `DODO_PRODUCT_PRO_YEARLY` | Pro annual subscription product ID | No |
| `GEMINI_API_KEY` | Gemini provider authentication | Yes |
| `COMPANY_ANALYSIS_PROVIDER` | Company analysis provider selection | No |
| `GEMINI_MODEL` | Gemini model override | No |
| `COMPANY_ANALYSIS_TIMEOUT_MS` | Provider timeout | No |
| `AZURE_OPENAI_ENDPOINT` | Optional Azure fallback endpoint | No |
| `AZURE_OPENAI_KEY` | Optional Azure fallback credential | Yes |
| `AZURE_OPENAI_DEPLOYMENT` | Optional Azure deployment | No |
| `AZURE_OPENAI_API_VERSION` | Optional Azure API version | No |
| `AI_DAILY_COMPANIES_PER_USER` | Server-enforced daily company budget | No |
| `COMPANY_WEBSITE_ENRICHMENT_ENABLED` | Public-website enrichment switch | No |
| `VITE_SUPABASE_URL` | Public Supabase project URL | No |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase anon key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server database access | Yes |
| `SENTRY_DSN` | Server error reporting | Treat as private |
| `VITE_SENTRY_DSN` | Browser error reporting | Public by design |
| `SENTRY_AUTH_TOKEN` | Source-map upload during build | Yes |
| `SENTRY_ORG` | Source-map upload organization | No |
| `SENTRY_PROJECT` | Source-map upload project | No |
| `RENDER_GIT_COMMIT` | Sentry release; provided by Render | No |
| `HONEYBADGER_CHECKIN_URL` | Worker liveness report URL | Yes |
| `DATA_RETENTION_DAYS` | Contact/raw-row retention period, 1–90 days; defaults to 90 | No |
| `DISABLE_HMR` | Local Vite watch behavior | No |
| `ICP_LIVE_TEST_PROJECT_REF` | Expected Supabase project in live tests | No |
| `ICP_ACCEPTANCE_APP_URL` | App URL used by live authorization test | No |

Simple Analytics uses its public script on public routes and server-side event submission without a credential.

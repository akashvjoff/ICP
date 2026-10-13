# Structured company intelligence engine

## Boundary

`POST /api/ai/company-intelligence` is an authenticated server route. It validates the request, removes personal contact fields, verifies that the requested lead belongs to the authenticated Supabase user, and only then calls the selected analysis provider. Browser code never receives `GEMINI_API_KEY`.

The engine distinguishes uploaded or public facts from inference. Potential needs and buying roles are explicitly hypotheses. Company size and geography are changed to `unknown` if a provider attempts to return them as unsupported inference. Revenue, funding, technology stack, budgets, buying intent, named decision makers, and customer lifetime value are absent from the output contract.

Every material result contains a value, origin, confidence, and an optional source field or URL. Responses are checked against the Zod schema before persistence. Invalid structured output is retried once; a second failure is stored as a visible error rather than malformed analysis JSON.

## Providers

- `gemini` is the default. It calls `models.list` for the configured API key and ranks available text models, preferring a Flash-Lite/Flash model. No model identifier is assumed to exist. `GEMINI_MODEL` is an optional override and is rejected when unavailable.
- `mock` is deterministic and intended for tests and local UI development.
- `ollama` is an optional local adapter. It uses `OLLAMA_MODEL` or the first model returned by the local tags endpoint.

Provider selection is server-only through `COMPANY_ANALYSIS_PROVIDER`. Set timeouts with `COMPANY_ANALYSIS_TIMEOUT_MS`.

## Cache and persistence

Sanitized analysis input is canonicalized and SHA-256 hashed. A completed result with the same owner and content hash is reused and copied to the requested lead. Completed and failed states are stored in `company_analyses`; RLS continues to enforce lead ownership.

Apply `supabase/migrations/20261012134608_company_intelligence_engine.sql` after the earlier migrations. It adds structured JSON, provider, input hash, and visible error fields without dropping existing data.

## Local verification

```sh
npm run lint
npm test
npm run test:pipeline
npm run build
```

The automated acceptance test uses a synthetic payroll software company and verifies HR technology, software/subscription, payroll products, plausible B2B buyers, and the absence of invented revenue or employee count.

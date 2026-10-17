import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { captureServerFailure } from '../telemetry';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

export interface StructuredRequest<T> {
  prompt: string;
  systemInstruction: string;
  schema: z.ZodType<T>;
  temperature?: number;
}

export interface StructuredResult<T> {
  value: T;
  provider: 'gemini' | 'azure-openai';
  model: string;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterMs?: number,
  ) { super(message); }
}

export interface AIProvider {
  readonly name: 'gemini' | 'azure-openai';
  readonly model: string;
  generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

type GeminiClient = Pick<GoogleGenAI, 'models'>;

function retryAfterMs(error: unknown): number | undefined {
  const candidate = error as { headers?: Headers | Record<string, string>; retryAfter?: string; retryDelay?: string };
  const headers = candidate?.headers;
  const headerValue = headers instanceof Headers ? headers.get('retry-after')
    : headers ? Object.entries(headers).find(([name]) => name.toLowerCase() === 'retry-after')?.[1] : undefined;
  const raw = headerValue || candidate?.retryAfter || candidate?.retryDelay;
  if (!raw) return undefined;
  const seconds = Number(raw.replace(/s$/, ''));
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function toProviderError(error: unknown): AIProviderError {
  if (error instanceof AIProviderError) return error;
  const candidate = error as { status?: number; code?: number | string; message?: string };
  const status = Number(candidate?.status || candidate?.code || 0);
  const message = String(candidate?.message || 'AI provider request failed.');
  const normalizedStatus = status || (/quota|rate.?limit/i.test(message) ? 429 : 502);
  return new AIProviderError(message, normalizedStatus, retryAfterMs(error));
}

export async function retryProviderCall<T>(call: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await call(); }
    catch (error) {
      const failure = toProviderError(error);
      if (attempt >= maxRetries || (failure.status !== 429 && failure.status < 500)) throw failure;
      const backoff = Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
      const delay = Math.max(failure.retryAfterMs || 0, backoff);
      // Long provider quotas belong in the durable job queue, not a sleeping request.
      if (delay > 15_000) throw failure;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !['$schema', 'additionalProperties', 'format', 'minLength', 'maxLength', 'minItems', 'maxItems'].includes(key)).map(([key, child]) => [key, clean(child)]));
  };
  return clean(z.toJSONSchema(schema, { target: 'openApi3' })) as Record<string, unknown>;
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;
  readonly model: string;
  private readonly client: GeminiClient;
  constructor(apiKey: string, model = DEFAULT_GEMINI_MODEL, private readonly timeoutMs = 60_000, client?: GeminiClient) {
    if (!apiKey || /YOUR_GEMINI_API_KEY|MY_GEMINI_API_KEY/.test(apiKey)) throw new AIProviderError('GEMINI_API_KEY is not configured on the server.', 503);
    this.model = model;
    this.client = client || new GoogleGenAI({ apiKey });
  }
  async generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    return retryProviderCall(async () => {
      const response = await this.client.models.generateContent({
        model: this.model, contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema(request.schema),
          temperature: request.temperature ?? 0.1,
          httpOptions: { timeout: this.timeoutMs },
        },
      });
      try { return { value: request.schema.parse(JSON.parse(response.text || '')), provider: this.name, model: this.model }; }
      catch { throw new AIProviderError('The provider returned invalid structured output.', 422); }
    });
  }
}

export class AzureOpenAIProvider implements AIProvider {
  readonly name = 'azure-openai' as const;
  readonly model: string;
  constructor(private readonly endpoint: string, private readonly key: string, deployment: string, private readonly apiVersion: string) {
    this.model = deployment;
  }
  async generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    return retryProviderCall(async () => {
      const url = `${this.endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(this.model)}/chat/completions?api-version=${encodeURIComponent(this.apiVersion)}`;
      const response = await fetch(url, {
        method: 'POST', headers: { 'api-key': this.key, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({ messages: [{ role: 'system', content: request.systemInstruction }, { role: 'user', content: `${request.prompt}\nReturn JSON matching this schema: ${JSON.stringify(jsonSchema(request.schema))}` }], response_format: { type: 'json_object' }, temperature: request.temperature ?? 0.1 }),
      });
      if (!response.ok) throw new AIProviderError(`Azure OpenAI returned ${response.status}.`, response.status, retryAfterMs({ headers: response.headers }));
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      try { return { value: request.schema.parse(JSON.parse(payload.choices?.[0]?.message?.content || '')), provider: this.name, model: this.model }; }
      catch { throw new AIProviderError('The provider returned invalid structured output.', 422); }
    });
  }
}

export function createAIProviders(env: NodeJS.ProcessEnv = process.env, geminiClient?: GeminiClient): AIProvider[] {
  const providers: AIProvider[] = [];
  if (env.GEMINI_API_KEY) providers.push(new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, Number(env.COMPANY_ANALYSIS_TIMEOUT_MS) || 60_000, geminiClient));
  if (env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_KEY && env.AZURE_OPENAI_DEPLOYMENT && env.AZURE_OPENAI_API_VERSION) {
    providers.push(new AzureOpenAIProvider(env.AZURE_OPENAI_ENDPOINT, env.AZURE_OPENAI_KEY, env.AZURE_OPENAI_DEPLOYMENT, env.AZURE_OPENAI_API_VERSION));
  }
  return providers;
}

export async function generateStructured<T>(request: StructuredRequest<T>, providers: AIProvider[]): Promise<StructuredResult<T>> {
  if (!providers.length) throw new AIProviderError('No AI provider is configured.', 503);
  let lastError: unknown;
  for (const provider of providers) {
    try { return await provider.generate(request); }
    catch (error) {
      captureServerFailure(error, { provider: provider.name, model: provider.model });
      lastError = error;
      if (!(error instanceof AIProviderError) || (error.status !== 429 && error.status !== 422 && error.status < 500)) break;
    }
  }
  throw lastError;
}

import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import {
  companyAnalysisInputSchema,
  companyIntelligenceSchema,
  type CompanyAnalysisInput,
  type CompanyIntelligence,
} from '../types/companyIntelligence';

export type AnalysisErrorCode =
  | 'MISSING_API_KEY'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_STRUCTURED_OUTPUT'
  | 'EMPTY_INFORMATION'
  | 'UNSUPPORTED_MODEL'
  | 'NETWORK_FAILURE'
  | 'PROVIDER_CONFIGURATION';

export class CompanyAnalysisError extends Error {
  constructor(
    public readonly code: AnalysisErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly recoverable = false,
  ) {
    super(message);
    this.name = 'CompanyAnalysisError';
  }
}

export interface CompanyAnalyzer {
  readonly providerName: string;
  analyze(input: CompanyAnalysisInput): Promise<{
    analysis: CompanyIntelligence;
    modelVersion: string;
  }>;
}

type ModelInfo = { name?: string; displayName?: string; supportedActions?: string[] };
type GeminiClientLike = {
  models: {
    list(params?: { config?: { pageSize?: number; queryBase?: boolean } }): Promise<AsyncIterable<ModelInfo>>;
    generateContent(params: Record<string, unknown>): Promise<{ text?: string }>;
  };
};

const PRIVATE_KEY_PATTERN = /(e-?mail|phone|mobile|contact|person|first.?name|last.?name|full.?name|linkedin|address)/i;
const EMAIL_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_VALUE_PATTERN = /(?:\+?\d[\s().-]*){7,}/;

function redactPersonalText(value: string): string {
  return value
    .replace(new RegExp(EMAIL_VALUE_PATTERN.source, 'gi'), '[REDACTED_CONTACT]')
    .replace(new RegExp(PHONE_VALUE_PATTERN.source, 'g'), '[REDACTED_CONTACT]');
}

function redactNestedText(value: unknown): unknown {
  if (typeof value === 'string') return redactPersonalText(value);
  if (Array.isArray(value)) return value.map(redactNestedText);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(
      ([key, child]) => [key, redactNestedText(child)]
    ));
  }
  return value;
}

export function sanitizeCompanyAnalysisInput(input: unknown): CompanyAnalysisInput {
  const parsed = companyAnalysisInputSchema.parse(input);
  const companyAttributes = Object.fromEntries(
    Object.entries(parsed.companyAttributes).filter(([key, value]) => {
      if (PRIVATE_KEY_PATTERN.test(key)) return false;
      const serialized = Array.isArray(value) ? value.join(' ') : String(value ?? '');
      return !EMAIL_VALUE_PATTERN.test(serialized) && !PHONE_VALUE_PATTERN.test(serialized);
    })
  );
  return {
    ...parsed,
    sellerProductContext: redactNestedText(parsed.sellerProductContext) as CompanyAnalysisInput['sellerProductContext'],
    companyProductDescription: redactPersonalText(parsed.companyProductDescription),
    publicWebsiteText: parsed.publicWebsiteText ? redactPersonalText(parsed.publicWebsiteText) : undefined,
    companyAttributes,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

export function createCompanyAnalysisHash(input: CompanyAnalysisInput): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(input))).digest('hex');
}

function normalizeModelName(name: string): string {
  return name.replace(/^models\//, '');
}

export function cleanGeminiSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(cleanGeminiSchema);
  const { $schema, additionalProperties, minLength, maxLength, minItems, maxItems, format, ...rest } = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    result[k] = cleanGeminiSchema(v);
  }
  return result;
}

export function getRankedGeminiModels(models: ModelInfo[], configuredModel?: string): string[] {
  const usable = models.filter((model) => {
    const name = normalizeModelName(model.name || '');
    const actions = model.supportedActions || [];
    return name.startsWith('gemini-') &&
      (actions.length === 0 || actions.some((action) => /generateContent/i.test(action))) &&
      !/(embedding|image|vision|audio|tts|live|robotics|2\.5-flash|2\.0-flash|1\.5-flash)/i.test(name);
  });

  if (configuredModel) {
    const requested = normalizeModelName(configuredModel);
    const match = usable.find((model) => normalizeModelName(model.name || '') === requested);
    if (!match?.name) {
      throw new CompanyAnalysisError(
        'UNSUPPORTED_MODEL',
        `Configured Gemini model "${configuredModel}" is not available for this API key.`,
        503,
      );
    }
    return [normalizeModelName(match.name)];
  }

  const ranked = usable
    .filter((model) => model.name)
    .sort((left, right) => {
      const score = (model: ModelInfo) => {
        const name = normalizeModelName(model.name || '');
        if (/3-flash-preview/i.test(name)) return 0;
        if (/flash-latest/i.test(name)) return 1;
        if (/3\.5-flash$/i.test(name)) return 2;
        if (/flash-lite/i.test(name)) return 3;
        if (/3\.7-flash/i.test(name)) return 4;
        if (/3\.8-flash$/i.test(name)) return 5;
        if (/3\.6-flash/i.test(name)) return 6;
        if (/flash/i.test(name)) return 7;
        if (/pro/i.test(name)) return 10;
        return 20;
      };
      return score(left) - score(right) || normalizeModelName(left.name || '').localeCompare(normalizeModelName(right.name || ''));
    });

  if (!ranked[0]?.name) {
    throw new CompanyAnalysisError('UNSUPPORTED_MODEL', 'No text-generation Gemini model is available for this API key.', 503);
  }
  return ranked.map((m) => normalizeModelName(m.name!));
}

export function selectPreferredGeminiModel(models: ModelInfo[], configuredModel?: string): string {
  return getRankedGeminiModels(models, configuredModel)[0];
}

function classifyProviderError(error: unknown): CompanyAnalysisError {
  if (error instanceof CompanyAnalysisError) return error;
  const candidate = error as { status?: number; code?: number | string; message?: string; name?: string };
  const status = Number(candidate?.status || candidate?.code || 0);
  const message = String(candidate?.message || 'Provider request failed.');
  if (status === 429 || /rate.?limit|quota/i.test(message)) {
    return new CompanyAnalysisError('RATE_LIMITED', 'The analysis provider is rate limited. Try again shortly.', 429, true);
  }
  if (/timeout|timed out|abort/i.test(message) || candidate?.name === 'AbortError') {
    return new CompanyAnalysisError('TIMEOUT', 'The analysis provider timed out. Try again.', 504, true);
  }
  if (status === 404 || /model.*not found|unsupported model/i.test(message)) {
    return new CompanyAnalysisError('UNSUPPORTED_MODEL', `The selected analysis model is unavailable: ${message}`, 503);
  }
  if (status === 503 || /high demand|unavailable|temporar/i.test(message)) {
    return new CompanyAnalysisError('UNSUPPORTED_MODEL', `The selected analysis model is temporarily unavailable: ${message}`, 503, true);
  }
  return new CompanyAnalysisError('NETWORK_FAILURE', `The analysis provider could not be reached: ${message}`, 502, true);
}

function parseStructuredAnalysis(text: string | undefined): CompanyIntelligence {
  if (!text?.trim()) {
    throw new CompanyAnalysisError('INVALID_STRUCTURED_OUTPUT', 'The provider returned an empty structured response.', 502, true);
  }
  try {
    return companyIntelligenceSchema.parse(JSON.parse(text));
  } catch {
    throw new CompanyAnalysisError('INVALID_STRUCTURED_OUTPUT', 'The provider returned invalid structured output.', 502, true);
  }
}

function enforceEvidenceGuards(analysis: CompanyIntelligence): CompanyIntelligence {
  const guarded = structuredClone(analysis);
  for (const key of ['company_size', 'geography'] as const) {
    if (guarded[key].origin === 'inferred') {
      guarded[key] = {
        value: 'unknown',
        origin: 'unknown',
        confidence: 'low',
      };
    }
  }
  return guarded;
}

const SYSTEM_INSTRUCTION = `You are FiguredIt's company intelligence normalizer.
Use only supplied uploaded attributes and the optional public webpage excerpt.
Every material claim must carry origin, confidence, and its source field or URL when available.
Potential business needs and buying roles are hypotheses, not observed pain or intent.
Never invent revenue, employee count, funding, technology stack, current pain, budget, buying intent, decision-maker identities, or customer lifetime value.
Use value "unknown", origin "unknown", and low confidence when evidence is absent.
Return only JSON matching the supplied schema.`;

function buildPrompt(input: CompanyAnalysisInput, retry = false): string {
  return `${retry ? 'The previous output failed validation. Correct it and return schema-valid JSON only.\n' : ''}` +
    `Analyze this company using the seller context only to frame explicitly hypothetical needs. ` +
    `If userCorrectedDescription is present, treat it as the current user-corrected company description and preserve it as uploaded evidence. ` +
    `Use publicWebsiteUrl as the source_url for claims supported by publicWebsiteText.\n` +
    `INPUT_JSON:\n${JSON.stringify(input)}`;
}

export class GeminiCompanyAnalyzer implements CompanyAnalyzer {
  readonly providerName = 'gemini';
  private selectedModel?: string;

  constructor(
    private readonly apiKey: string,
    private readonly configuredModel = '',
    private readonly timeoutMs = 60_000,
    private readonly client?: GeminiClientLike,
  ) {}

  private getClient(): GeminiClientLike {
    if (!this.apiKey || this.apiKey.includes('MY_GEMINI_API_KEY')) {
      throw new CompanyAnalysisError('MISSING_API_KEY', 'GEMINI_API_KEY is not configured on the server.', 503);
    }
    return this.client || new GoogleGenAI({ apiKey: this.apiKey }) as unknown as GeminiClientLike;
  }

  private async resolveCandidateModels(client: GeminiClientLike): Promise<string[]> {
    if (this.selectedModel) return [this.selectedModel];
    try {
      const pager = await client.models.list({ config: { pageSize: 100, queryBase: true } });
      const models: ModelInfo[] = [];
      for await (const model of pager) models.push(model);
      return getRankedGeminiModels(models, this.configuredModel || undefined);
    } catch (error) {
      throw classifyProviderError(error);
    }
  }

  async analyze(rawInput: CompanyAnalysisInput) {
    const input = sanitizeCompanyAnalysisInput(rawInput);
    const client = this.getClient();
    const candidates = await this.resolveCandidateModels(client);
    const rawSchema = z.toJSONSchema(companyIntelligenceSchema, { target: 'openApi3' });
    const responseJsonSchema = cleanGeminiSchema(rawSchema) as Record<string, unknown>;

    let lastError: CompanyAnalysisError | null = null;
    for (const model of candidates) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await client.models.generateContent({
            model,
            contents: buildPrompt(input, attempt === 1),
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseJsonSchema,
              temperature: 0.1,
              httpOptions: { timeout: this.timeoutMs },
            },
          });
          this.selectedModel = model;
          return { analysis: enforceEvidenceGuards(parseStructuredAnalysis(response.text)), modelVersion: model };
        } catch (error) {
          const classified = classifyProviderError(error);
          lastError = classified;
          if (classified.code === 'INVALID_STRUCTURED_OUTPUT' && attempt === 0) continue;
          if (classified.code === 'UNSUPPORTED_MODEL' || classified.statusCode === 503 || classified.statusCode === 502) {
            break;
          }
          throw classified;
        }
      }
    }
    throw lastError || new CompanyAnalysisError('NETWORK_FAILURE', 'All candidate Gemini models failed.', 502);
  }
}

function claim(value: string, origin: 'uploaded' | 'inferred' | 'unknown', confidence: 'high' | 'medium' | 'low', sourceField?: string) {
  return { value, origin, confidence, ...(sourceField ? { source_field: sourceField } : {}) };
}

function listClaim(value: string[], origin: 'uploaded' | 'inferred' | 'unknown', confidence: 'high' | 'medium' | 'low', sourceField?: string) {
  return { value, origin, confidence, ...(sourceField ? { source_field: sourceField } : {}) };
}

export class MockCompanyAnalyzer implements CompanyAnalyzer {
  readonly providerName = 'mock';

  async analyze(rawInput: CompanyAnalysisInput) {
    const input = sanitizeCompanyAnalysisInput(rawInput);
    const corpus = `${input.companyName} ${input.companyProductDescription} ${input.publicWebsiteText || ''}`.toLowerCase();
    const payroll = /payroll|pay run|salary|wage/.test(corpus);
    const industry = payroll ? 'HR Technology' : 'Business Software';
    const products = payroll ? ['Payroll processing software', 'Payroll compliance workflows'] : ['Business software platform'];
    const companySize = input.companyAttributes.employee_count ?? input.companyAttributes.company_size;
    const geography = input.companyAttributes.geography ?? input.companyAttributes.country;
    const analysis: CompanyIntelligence = {
      company_type: claim(payroll ? 'SaaS startup' : 'Software company', 'inferred', 'medium'),
      industry: claim(industry, 'inferred', payroll ? 'high' : 'medium'),
      sub_industry: claim(payroll ? 'Payroll software' : 'Business productivity software', 'inferred', payroll ? 'high' : 'low'),
      business_model: claim(payroll ? 'B2B software subscription' : 'B2B software', 'inferred', 'medium'),
      product_summary: claim(input.companyProductDescription || 'Software product details were not supplied.', input.companyProductDescription ? 'uploaded' : 'unknown', input.companyProductDescription ? 'high' : 'low', input.companyProductDescription ? 'companyProductDescription' : undefined),
      products: listClaim(products, 'inferred', payroll ? 'high' : 'low'),
      target_customers: listClaim(payroll ? ['Employers', 'HR teams', 'Payroll administrators'] : ['Business teams'], 'inferred', 'medium'),
      value_proposition: claim(payroll ? 'Helps employers run payroll and manage payroll compliance workflows.' : 'Insufficient evidence for a specific value proposition.', payroll ? 'inferred' : 'unknown', payroll ? 'medium' : 'low'),
      potential_business_needs: listClaim(['Potential need: improve workflow efficiency relevant to the seller offering'], 'inferred', 'low'),
      potential_buying_roles: listClaim(payroll ? ['Head of HR', 'Payroll Manager', 'Finance leader'] : ['Operations leader'], 'inferred', 'low'),
      company_size: claim(companySize === undefined ? 'unknown' : String(companySize), companySize === undefined ? 'unknown' : 'uploaded', companySize === undefined ? 'low' : 'high', companySize === undefined ? undefined : 'companyAttributes'),
      geography: claim(geography === undefined ? 'unknown' : String(geography), geography === undefined ? 'unknown' : 'uploaded', geography === undefined ? 'low' : 'high', geography === undefined ? undefined : 'companyAttributes'),
      evidence: input.companyProductDescription ? [{ attribute: 'product_summary', summary: 'Based on the uploaded company product description.', origin: 'uploaded', source_field: 'companyProductDescription' }] : [],
      data_quality: {
        completeness: input.companyProductDescription ? 'medium' : 'low',
        confidence: payroll ? 'medium' : 'low',
        missing_fields: [companySize === undefined ? 'company_size' : '', geography === undefined ? 'geography' : ''].filter(Boolean),
        limitations: ['Sample analysis is illustrative and should be checked against real company information.', 'Potential needs and buying roles are unvalidated hypotheses.'],
      },
    };
    return { analysis, modelVersion: 'mock-company-analyzer-v1' };
  }
}

export class OllamaCompanyAnalyzer implements CompanyAnalyzer {
  readonly providerName = 'ollama';

  constructor(
    private readonly baseUrl = 'http://127.0.0.1:11434',
    private readonly configuredModel = '',
    private readonly timeoutMs = 30_000,
  ) {}

  private async resolveModel(): Promise<string> {
    if (this.configuredModel) return this.configuredModel;
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!response.ok) throw new Error(`Ollama model list returned ${response.status}.`);
      const payload = await response.json() as { models?: Array<{ name?: string }> };
      const model = payload.models?.[0]?.name;
      if (!model) throw new CompanyAnalysisError('UNSUPPORTED_MODEL', 'No local Ollama model is installed.', 503);
      return model;
    } catch (error) {
      throw classifyProviderError(error);
    }
  }

  async analyze(rawInput: CompanyAnalysisInput) {
    const input = sanitizeCompanyAnalysisInput(rawInput);
    const model = await this.resolveModel();
    const format = z.toJSONSchema(companyIntelligenceSchema, { target: 'draft-7' });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
          body: JSON.stringify({
            model,
            stream: false,
            think: false,
            format,
            messages: [
              { role: 'system', content: SYSTEM_INSTRUCTION },
              { role: 'user', content: buildPrompt(input, attempt === 1) },
            ],
            options: { temperature: 0.1 },
          }),
        });
        if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
        const payload = await response.json() as { message?: { content?: string } };
        return { analysis: enforceEvidenceGuards(parseStructuredAnalysis(payload.message?.content)), modelVersion: model };
      } catch (error) {
        const classified = classifyProviderError(error);
        if (classified.code === 'INVALID_STRUCTURED_OUTPUT' && attempt === 0) continue;
        throw classified;
      }
    }
    throw new CompanyAnalysisError('INVALID_STRUCTURED_OUTPUT', 'Ollama returned invalid structured output twice.', 502);
  }
}

export function createCompanyAnalyzer(env: NodeJS.ProcessEnv = process.env): CompanyAnalyzer {
  const provider = (env.COMPANY_ANALYSIS_PROVIDER || 'gemini').toLowerCase();
  const timeout = Number.parseInt(env.COMPANY_ANALYSIS_TIMEOUT_MS || '60000', 10);
  if (provider === 'mock') return new MockCompanyAnalyzer();
  if (provider === 'ollama') return new OllamaCompanyAnalyzer(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL, timeout);
  if (provider === 'gemini') return new GeminiCompanyAnalyzer(env.GEMINI_API_KEY || '', env.GEMINI_MODEL || '', timeout);
  throw new CompanyAnalysisError('PROVIDER_CONFIGURATION', `Unsupported company analysis provider "${provider}".`, 503);
}

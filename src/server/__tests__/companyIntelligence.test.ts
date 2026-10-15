import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { AIProviderError, generateStructured, retryProviderCall, type AIProvider } from '../ai/provider';
import {
  CompanyAnalysisError,
  GeminiCompanyAnalyzer,
  MockCompanyAnalyzer,
  createCompanyAnalyzer,
  sanitizeCompanyAnalysisInput,
  selectPreferredGeminiModel,
} from '../companyAnalyzer';
import { analyzeCompanyWithCache, type CompanyAnalysisRepository } from '../companyIntelligenceService';
import type { CompanyAnalysisEnvelope, CompanyAnalysisInput } from '../../types/companyIntelligence';

const payrollInput: CompanyAnalysisInput = {
  sellerProductContext: {
    companyName: 'Seller Synthetic',
    productName: 'Workflow Product',
    productDescription: 'B2B workflow automation for finance teams.',
  },
  companyName: 'Payroll Labs Synthetic',
  companyDomain: 'payroll-labs.example',
  companyProductDescription: 'Cloud payroll software with automated pay runs, tax calculations, and employee payroll reporting.',
  companyAttributes: {},
  userCorrectedDescription: '',
};

test('payroll acceptance case identifies HR technology, subscription software, payroll products, and B2B buyers', async () => {
  const result = await new MockCompanyAnalyzer().analyze(payrollInput);
  assert.equal(result.analysis.industry.value, 'HR Technology');
  assert.match(result.analysis.business_model.value, /B2B.*subscription/i);
  assert.ok(result.analysis.products.value.some((value) => /payroll/i.test(value)));
  assert.ok(result.analysis.target_customers.value.some((value) => /employer|HR|payroll/i.test(value)));
  assert.equal(result.analysis.company_size.value, 'unknown');
  assert.equal(result.analysis.company_size.origin, 'unknown');
  assert.equal(JSON.stringify(result.analysis).includes('revenue'), false);
});

test('personal contact fields and values are removed before provider use', () => {
  const sanitized = sanitizeCompanyAnalysisInput({
    ...payrollInput,
    companyProductDescription: 'Payroll software. Contact private.person@example.com or +1 555 555 0100.',
    publicWebsiteText: 'Sales: website-contact@example.com',
    companyAttributes: {
      industry: 'HR software',
      contact_email: 'private.person@example.com',
      phone: '+1 555 555 0100',
      notes: 'Reach jane@example.com',
    },
  });
  assert.deepEqual(sanitized.companyAttributes, { industry: 'HR software' });
  assert.doesNotMatch(sanitized.companyProductDescription, /private\.person|555 555/);
  assert.doesNotMatch(sanitized.publicWebsiteText || '', /website-contact/);
});

test('empty company information is rejected before any provider call', () => {
  assert.throws(
    () => sanitizeCompanyAnalysisInput({
      sellerProductContext: {},
      companyName: 'Name Only Synthetic',
      companyDomain: '',
      companyProductDescription: '',
      companyAttributes: {},
    }),
    /Provide a domain, product description, company attributes, or safely extracted public website text/,
  );
});

test('runtime model selection prefers an available fast low-cost model and rejects unavailable overrides', () => {
  const models = [
    { name: 'models/gemini-pro-current', supportedActions: ['generateContent'] },
    { name: 'models/gemini-flash-current', supportedActions: ['generateContent'] },
    { name: 'models/gemini-flash-lite-current', supportedActions: ['generateContent'] },
  ];
  assert.equal(selectPreferredGeminiModel(models), 'gemini-flash-lite-current');
  assert.throws(
    () => selectPreferredGeminiModel(models, 'gemini-does-not-exist'),
    (error) => error instanceof CompanyAnalysisError && error.code === 'UNSUPPORTED_MODEL',
  );
});

test('stable Flash is preferred over preview when a model is not specified', () => {
  assert.equal(selectPreferredGeminiModel([
    { name: 'models/gemini-3-flash-preview', supportedActions: ['generateContent'] },
    { name: 'models/gemini-3.5-flash', supportedActions: ['generateContent'] },
  ]), 'gemini-3.5-flash');
});

test('Gemini analyzer retries invalid structured JSON once and validates the corrected result', async () => {
  const valid = (await new MockCompanyAnalyzer().analyze(payrollInput)).analysis;
  let generationCalls = 0;
  const client = {
    models: {
      async list() {
        return (async function* () {
          yield { name: 'models/gemini-flash-lite-current', supportedActions: ['generateContent'] };
        })();
      },
      async generateContent() {
        generationCalls += 1;
        return { text: generationCalls === 1 ? '{invalid' : JSON.stringify(valid) };
      },
    },
  };
  const result = await new GeminiCompanyAnalyzer('synthetic-key', '', 1_000, client).analyze(payrollInput);
  assert.equal(generationCalls, 2);
  assert.equal(result.analysis.industry.value, 'HR Technology');
  assert.equal(result.modelVersion, 'gemini-flash-lite-current');
});

test('duplicate company content is served from cache and copied to the authorized lead', async () => {
  const cache = new Map<string, CompanyAnalysisEnvelope>();
  const saves: string[] = [];
  const repository: CompanyAnalysisRepository = {
    async assertOwnedLead(_owner, leadId) {
      if (leadId === '00000000-0000-4000-8000-000000000099') {
        throw new CompanyAnalysisError('EMPTY_INFORMATION', 'The requested company record was not found.', 404);
      }
    },
    async findCached(_owner, hash) { return cache.get(hash) || null; },
    async saveCompleted(_owner, leadId, hash, envelope) {
      saves.push(leadId);
      cache.set(hash, envelope);
    },
    async saveFailed() {},
  };
  const analyzer = new MockCompanyAnalyzer();
  let calls = 0;
  const countingAnalyzer = {
    providerName: analyzer.providerName,
    async analyze(input: CompanyAnalysisInput) { calls += 1; return analyzer.analyze(input); },
  };
  const firstLead = '00000000-0000-4000-8000-000000000001';
  const secondLead = '00000000-0000-4000-8000-000000000002';
  const first = await analyzeCompanyWithCache(repository, countingAnalyzer, 'owner-1', firstLead, payrollInput);
  const second = await analyzeCompanyWithCache(repository, countingAnalyzer, 'owner-1', secondLead, payrollInput);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(calls, 1);
  assert.deepEqual(saves, [firstLead, secondLead]);
});

test('authorization failure prevents provider execution', async () => {
  let analyzed = false;
  const repository: CompanyAnalysisRepository = {
    async assertOwnedLead() { throw new CompanyAnalysisError('EMPTY_INFORMATION', 'The requested company record was not found.', 404); },
    async findCached() { return null; },
    async saveCompleted() {},
    async saveFailed() {},
  };
  const analyzer = {
    providerName: 'test',
    async analyze() { analyzed = true; return new MockCompanyAnalyzer().analyze(payrollInput); },
  };
  await assert.rejects(
    () => analyzeCompanyWithCache(repository, analyzer, 'owner-1', '00000000-0000-4000-8000-000000000099', payrollInput),
    /not found/,
  );
  assert.equal(analyzed, false);
});

test('missing Gemini key produces a visible configuration error', async () => {
  await assert.rejects(
    () => new GeminiCompanyAnalyzer('').analyze(payrollInput),
    (error) => error instanceof CompanyAnalysisError && error.code === 'MISSING_API_KEY',
  );
});

test('signed-in analysis cannot select the sample provider', () => {
  assert.throws(
    () => createCompanyAnalyzer({ COMPANY_ANALYSIS_PROVIDER: 'mock' }),
    (error) => error instanceof CompanyAnalysisError && error.code === 'PROVIDER_CONFIGURATION',
  );
});

test('provider retries transient 5xx responses up to success', async () => {
  let calls = 0;
  const result = await retryProviderCall(async () => {
    calls += 1;
    if (calls < 3) throw new AIProviderError('Temporary outage', 503, 0);
    return 'ready';
  });
  assert.equal(result, 'ready');
  assert.equal(calls, 3);
});

test('Azure fallback is validated against the same Zod schema and records its model', async () => {
  const schema = z.object({ answer: z.string() });
  const providers: AIProvider[] = [
    { name: 'gemini', model: 'gemini-3.5-flash', async generate<T>() { throw new AIProviderError('Quota', 429, 60_000); } },
    { name: 'azure-openai', model: 'fallback-deployment', async generate<T>(request: { schema: z.ZodType<T> }) {
      return { value: request.schema.parse({ answer: 'ok' }), provider: 'azure-openai' as const, model: 'fallback-deployment' };
    } },
  ];
  const result = await generateStructured({ prompt: 'Test', systemInstruction: 'Return JSON', schema }, providers);
  assert.equal(result.value.answer, 'ok');
  assert.equal(result.provider, 'azure-openai');
  assert.equal(result.model, 'fallback-deployment');
});

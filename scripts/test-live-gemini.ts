import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  GeminiCompanyAnalyzer,
  sanitizeCompanyAnalysisInput,
  createCompanyAnalysisHash,
  CompanyAnalysisError,
} from '../src/server/companyAnalyzer.ts';
import {
  companyIntelligenceSchema,
  type CompanyAnalysisInput,
} from '../src/types/companyIntelligence.ts';
import {
  analyzeCompanyWithCache,
  createSupabaseCompanyAnalysisRepository,
} from '../src/server/companyIntelligenceService.ts';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runGeminiAcceptanceTest() {
  console.log('================================================================');
  console.log('ICP.MODE: RUNNING LIVE GEMINI AI ACCEPTANCE TEST');
  console.log('================================================================');

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('MY_GEMINI_API_KEY')) {
    console.error('[ERROR] GEMINI_API_KEY is not configured in .env');
    console.log('Please set GEMINI_API_KEY in your local .env to run this test.');
    process.exit(1);
  }

  // 1. PII Redaction Verification
  console.log('\n[1/5] Verifying PII sanitization and redaction...');
  const rawInputWithPII: CompanyAnalysisInput = {
    companyName: 'Acme Cloud Compliance',
    companyDomain: 'acmecloud.example.org',
    companyProductDescription: 'Automated SOC2 compliance software. Contact founder at founder@acmecloud.com or +1 (555) 019-2834.',
    userCorrectedDescription: 'Verified leader in automated SOC2 and HIPAA compliance pipelines.',
    companyAttributes: {
      headcount_raw: '45',
      founded: '2021',
      direct_contact_email: 'secret.personal@acmecloud.com',
      personal_cell: '+1-555-987-6543',
      valid_metric: 'B2B SaaS',
    },
    sellerProductContext: {
      productName: 'AuditFlow Pro',
      productDescription: 'Continuous audit automation platform for high-growth tech companies',
    },
  };

  const sanitized = sanitizeCompanyAnalysisInput(rawInputWithPII);

  // Assert PII was stripped from companyAttributes
  if ('direct_contact_email' in sanitized.companyAttributes || 'personal_cell' in sanitized.companyAttributes) {
    throw new Error('PII Leak: direct contact fields were not removed from companyAttributes');
  }
  // Assert PII was redacted from description
  if (sanitized.companyProductDescription.includes('founder@acmecloud.com') || sanitized.companyProductDescription.includes('+1 (555) 019-2834')) {
    throw new Error('PII Leak: phone/email was not redacted from product description');
  }
  if (!sanitized.companyProductDescription.includes('[REDACTED_CONTACT]')) {
    throw new Error('PII Redaction token missing from product description');
  }
  console.log('✓ PII sanitization passed: Emails and phones redacted/stripped.');

  // 2. Real Gemini Request (ONE single company)
  console.log('\n[2/5] Sending ONE synthetic company request to Gemini API...');
  const startTime = Date.now();
  const analyzer = new GeminiCompanyAnalyzer(apiKey, process.env.GEMINI_MODEL || '');

  let result;
  try {
    result = await analyzer.analyze(sanitized);
  } catch (err: any) {
    if (err instanceof CompanyAnalysisError) {
      console.error(`[AI ERROR] Code: ${err.code}, Status: ${err.statusCode}`);
      console.error(`Message: ${err.message}`);
      console.error('Details:', err.cause || err);
      if (err.code === 'RATE_LIMITED') {
        console.error('Note: Rate limit reached. Free-tier per-minute limit may be exceeded.');
      } else if (err.code === 'MISSING_API_KEY') {
        console.error('Note: API key is invalid or missing.');
      }
    } else {
      console.error('[UNEXPECTED ERROR]', err?.message || err);
    }
    process.exit(1);
  }

  const durationMs = Date.now() - startTime;
  console.log(`✓ Gemini response received in ${durationMs}ms`);
  console.log(`  Model utilized: ${result.modelVersion}`);

  // 3. Structured Output Validation
  console.log('\n[3/5] Validating structured output against schema...');
  const parsed = companyIntelligenceSchema.safeParse(result.analysis);
  if (!parsed.success) {
    console.error('[VALIDATION FAILED]', parsed.error.issues);
    throw new Error('Structured output does not conform to companyIntelligenceSchema');
  }
  console.log('✓ Structured output validated:');
  console.log(`  - Business Model: ${parsed.data.business_model.value} (Confidence: ${parsed.data.business_model.confidence})`);
  console.log(`  - Products: ${parsed.data.products.value.join(', ')}`);
  console.log(`  - Target Customers: ${parsed.data.target_customers.value.join(', ')}`);
  console.log(`  - Potential Business Needs: ${parsed.data.potential_business_needs.value.length} detected`);
  console.log(`  - Buying Roles: ${parsed.data.potential_buying_roles.value.length} identified`);

  // 4. Invariant Checks (Anti-hallucination & Evidence Guards)
  console.log('\n[4/5] Checking anti-hallucination & evidence invariants...');
  if (parsed.data.company_size.origin === 'inferred') {
    throw new Error('Invariant violation: company_size was marked inferred instead of unknown');
  }
  if (parsed.data.geography.origin === 'inferred') {
    throw new Error('Invariant violation: geography was marked inferred instead of unknown');
  }
  console.log('✓ Evidence invariants passed: No hallucinated firmographic values permitted.');

  // 5. Database Persistence & Isolation (if Supabase is available)
  if (supabaseUrl && serviceRoleKey) {
    console.log('\n[5/5] Testing persistence to remote Supabase database...');
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Create synthetic test user & lead
    const testEmail = `gemini_test_${Date.now()}@synthetic-test.org`;
    const { data: userRecord, error: userError } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: 'SecureTestP@ss1234!',
      email_confirm: true,
    });
    if (userError || !userRecord?.user) {
      throw new Error(`Failed to create synthetic user for persistence test: ${userError?.message}`);
    }
    const testUserId = userRecord.user.id;

    try {
      // Create synthetic dataset & lead
      const { data: dataset, error: dsError } = await adminClient
        .from('datasets')
        .insert({
          owner_user_id: testUserId,
          name: 'Gemini Test Dataset',
          original_filename: 'synthetic_gemini.csv',
          row_count: 1,
          status: 'uploaded',
        })
        .select('id')
        .single();
      if (dsError || !dataset) throw new Error(`Failed to insert test dataset: ${dsError?.message}`);

      const { data: lead, error: leadError } = await adminClient
        .from('leads')
        .insert({
          owner_user_id: testUserId,
          dataset_id: dataset.id,
          company_name: 'Acme Cloud Compliance',
          normalized_domain: 'acmecloud.example.org',
          website: 'https://acmecloud.example.org',
          industry_raw: 'Cloud Security & Compliance',
          analysis_eligible: true,
          analysis_status: 'pending',
          raw_row: rawInputWithPII,
        })
        .select('id')
        .single();
      if (leadError || !lead) throw new Error(`Failed to insert test lead: ${leadError?.message}`);

      // Save via repository
      const repository = createSupabaseCompanyAnalysisRepository(adminClient);
      const inputHash = createCompanyAnalysisHash(sanitized);
      const envelope = {
        analysis: parsed.data,
        provider: 'gemini',
        modelVersion: result.modelVersion,
        analyzedAt: new Date().toISOString(),
        cached: false,
        sourceMode: 'uploaded_only' as const,
        userCorrectedDescription: sanitized.userCorrectedDescription || '',
      };
      await repository.saveCompleted(testUserId, lead.id, inputHash, envelope, sanitized);

      // Verify cached retrieval
      const cached = await repository.findCached(testUserId, inputHash);
      if (!cached) {
        throw new Error('Failed to retrieve cached analysis from repository');
      }

      // Verify row in company_analyses table
      const { data: dbAnalysis, error: verifyError } = await adminClient
        .from('company_analyses')
        .select('analysis_json, business_model, analysis_status, model_version')
        .eq('lead_id', lead.id)
        .single();

      if (verifyError || !dbAnalysis) {
        throw new Error(`Failed to verify persisted company analysis: ${verifyError?.message}`);
      }
      if (dbAnalysis.analysis_status !== 'completed') {
        throw new Error(`Analysis status is ${dbAnalysis.analysis_status}, expected completed`);
      }
      if (!dbAnalysis.analysis_json || !dbAnalysis.business_model) {
        throw new Error('analysis_json or business_model was not saved to company_analyses');
      }

      // Verify user corrected description was saved to leads
      const { data: dbLead } = await adminClient
        .from('leads')
        .select('user_corrected_description')
        .eq('id', lead.id)
        .single();

      if (!dbLead?.user_corrected_description) {
        throw new Error('user_corrected_description was not updated in lead record');
      }

      console.log('✓ Remote persistence verified: Stored in company_analyses, status marked "completed".');
      console.log(`  Persisted business_model: ${dbAnalysis.business_model}`);
      console.log(`  Persisted model_version: ${dbAnalysis.model_version}`);
      console.log(`  User correction saved: "${dbLead.user_corrected_description}"`);
    } finally {
      // Cleanup synthetic user
      await adminClient.auth.admin.deleteUser(testUserId);
      console.log('✓ Synthetic test user and associated records cleaned up.');
    }
  } else {
    console.log('\n[5/5] Supabase credentials not set, skipping database persistence check.');
  }

  console.log('\n================================================================');
  console.log('RESULT: GEMINI ACCEPTANCE TEST PASSED (1/1 Synthetic Company)');
  console.log('================================================================\n');
}

runGeminiAcceptanceTest().catch((error) => {
  console.error('\n[FATAL ERROR]', error.message || error);
  process.exit(1);
});

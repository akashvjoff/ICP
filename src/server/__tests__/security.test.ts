import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createRequireAuthenticatedUser,
  type AuthenticatedRequest,
} from '../authMiddleware';
import { InMemoryStrategicAnalysisRepository } from '../strategicAnalysisService';
import { InMemorySTPRepository } from '../stpService';
import { InMemoryScoringRepository } from '../scoringService';
import { InMemoryReportRepository, sanitizeCsvCell } from '../reportService';
import { assertPublicAddress, normalizeCompanyHomepage } from '../websiteEnrichment';
import { exportAccountData } from '../accountDataService';

// Helper to create mock Express request, response, and next function
function createMockHttp(headers: Record<string, string> = {}) {
  const req = {
    headers: { ...headers },
  } as unknown as AuthenticatedRequest;

  let statusCode = 200;
  let jsonBody: unknown = null;
  let nextCalled = false;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getBody: () => jsonBody,
    isNextCalled: () => nextCalled,
  };
}

// -----------------------------------------------------------------------------
// 1. AUTHENTICATION & DEMO ISOLATION TESTS
// -----------------------------------------------------------------------------

test('1. Offline Demo Mode: Grants demo access when Supabase is not configured', async () => {
  const middleware = createRequireAuthenticatedUser({
    isSupabaseConfigured: false,
    serverSupabase: null,
  });

  const { req, res, next, isNextCalled } = createMockHttp({});
  await middleware(req, res, next);

  assert.equal(isNextCalled(), true, 'Must proceed to next handler');
  assert.equal(req.user?.id, 'demo-user-id');
  assert.equal(req.user?.email, 'alex@synthetix.io');
  assert.equal(req.accessToken, 'demo-token');
});

test('2. Offline Demo Mode: Preserves passed bearer token if provided', async () => {
  const middleware = createRequireAuthenticatedUser({
    isSupabaseConfigured: false,
    serverSupabase: null,
  });

  const { req, res, next, isNextCalled } = createMockHttp({
    authorization: 'Bearer local-custom-session',
  });
  await middleware(req, res, next);

  assert.equal(isNextCalled(), true);
  assert.equal(req.user?.id, 'demo-user-id');
  assert.equal(req.accessToken, 'local-custom-session');
});

test('2b. Production Mode Fail-Closed: Blocks requests with 503 if Supabase is unconfigured', async () => {
  const middleware = createRequireAuthenticatedUser({
    isSupabaseConfigured: false,
    serverSupabase: null,
    isProduction: true,
    allowProductionDemo: false,
  });

  const { req, res, next, getStatus, getBody, isNextCalled } = createMockHttp({});
  await middleware(req, res, next);

  assert.equal(isNextCalled(), false, 'Must not call next');
  assert.equal(getStatus(), 503);
  assert.deepEqual(getBody(), {
    error: 'Production authentication is not configured. Server is operating in secure fail-closed mode.',
  });
});

test('2c. Production Mode Explicit Demo Override: Allows demo if ALLOW_PRODUCTION_DEMO is true', async () => {
  const middleware = createRequireAuthenticatedUser({
    isSupabaseConfigured: false,
    serverSupabase: null,
    isProduction: true,
    allowProductionDemo: true,
  });

  const { req, res, next, isNextCalled } = createMockHttp({});
  await middleware(req, res, next);

  assert.equal(isNextCalled(), true, 'Must call next when explicitly allowed');
  assert.equal(req.user?.id, 'demo-user-id');
});

test('3. Production Mode: Blocks unauthenticated requests with 401', async () => {
  const middleware = createRequireAuthenticatedUser({
    isSupabaseConfigured: true,
    serverSupabase: {} as SupabaseClient,
  });

  const { req, res, next, getStatus, getBody, isNextCalled } = createMockHttp({});
  await middleware(req, res, next);

  assert.equal(isNextCalled(), false, 'Must not call next');
  assert.equal(getStatus(), 401);
  assert.deepEqual(getBody(), {
    error: 'Sign in to continue. Production authentication required.',
  });
});

test('4. Production Mode: Strictly rejects demo-token with 401', async () => {
  const middleware = createRequireAuthenticatedUser({
    isSupabaseConfigured: true,
    serverSupabase: {} as SupabaseClient,
  });

  const { req, res, next, getStatus, getBody, isNextCalled } = createMockHttp({
    authorization: 'Bearer demo-token',
  });
  await middleware(req, res, next);

  assert.equal(isNextCalled(), false, 'Must not call next');
  assert.equal(getStatus(), 401);
  assert.deepEqual(getBody(), {
    error: 'Sign in to continue. Production authentication required.',
  });
});

test('5. Production Mode: Returns 503 if Supabase client instance is unavailable', async () => {
  const middleware = createRequireAuthenticatedUser({
    isSupabaseConfigured: true,
    serverSupabase: null,
  });

  const { req, res, next, getStatus, getBody, isNextCalled } = createMockHttp({
    authorization: 'Bearer real-jwt-token-123',
  });
  await middleware(req, res, next);

  assert.equal(isNextCalled(), false);
  assert.equal(getStatus(), 503);
  assert.deepEqual(getBody(), {
    error: 'Authentication service temporarily unavailable.',
  });
});

test('6. Production Mode: Rejects invalid or expired token with 401', async () => {
  const mockSupabase = {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: null },
        error: new Error('JWT expired'),
      }),
    },
  } as unknown as SupabaseClient;

  const middleware = createRequireAuthenticatedUser({
    isSupabaseConfigured: true,
    serverSupabase: mockSupabase,
  });

  const { req, res, next, getStatus, getBody, isNextCalled } = createMockHttp({
    authorization: 'Bearer expired-jwt-token',
  });
  await middleware(req, res, next);

  assert.equal(isNextCalled(), false);
  assert.equal(getStatus(), 401);
  assert.deepEqual(getBody(), {
    error: 'Your session is invalid or expired. Please sign in again.',
  });
});

test('7. Production Mode: Successfully verifies valid user and populates req.user', async () => {
  const mockSupabase = {
    auth: {
      getUser: async (token: string) => {
        if (token === 'valid-user-token-xyz') {
          return {
            data: {
              user: {
                id: 'prod-user-456',
                email: 'sarah@enterprise.com',
              },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
  } as unknown as SupabaseClient;

  const middleware = createRequireAuthenticatedUser({
    isSupabaseConfigured: true,
    serverSupabase: mockSupabase,
  });

  const { req, res, next, isNextCalled } = createMockHttp({
    authorization: 'Bearer valid-user-token-xyz',
  });
  await middleware(req, res, next);

  assert.equal(isNextCalled(), true);
  assert.equal(req.user?.id, 'prod-user-456');
  assert.equal(req.user?.email, 'sarah@enterprise.com');
  assert.equal(req.accessToken, 'valid-user-token-xyz');
});

// -----------------------------------------------------------------------------
// 2. MULTI-TENANT ISOLATION TESTS
// -----------------------------------------------------------------------------

test('8. Cross-Tenant Isolation: InMemoryStrategicAnalysisRepository enforces dataset boundaries', async () => {
  const repo = new InMemoryStrategicAnalysisRepository();
  repo.setDatasetOwner('dataset-alpha', 'user-alice');

  // Alice succeeds
  await assert.doesNotReject(async () => {
    await repo.assertOwnedDataset('user-alice', 'dataset-alpha');
  });

  // Bob fails
  await assert.rejects(
    async () => {
      await repo.assertOwnedDataset('user-bob', 'dataset-alpha');
    },
    /not found or not owned by user/
  );

  // Bob cannot read Alice's strategic analysis
  const bobRead = await repo.getDatasetStrategicAnalysis('user-bob', 'dataset-alpha');
  assert.equal(bobRead, null);
});

test('9. Cross-Tenant Isolation: InMemorySTPRepository enforces dataset boundaries', async () => {
  const repo = new InMemorySTPRepository();
  repo.setDatasetOwner('dataset-beta', 'user-alice');

  // Alice succeeds
  await assert.doesNotReject(async () => {
    await repo.assertOwnedDataset('user-alice', 'dataset-beta');
  });

  // Bob fails
  await assert.rejects(
    async () => {
      await repo.assertOwnedDataset('user-bob', 'dataset-beta');
    },
    /not found or not owned by user/
  );

  // Bob cannot read Alice's STP analysis
  const bobRead = await repo.getDatasetSTPAnalysis('user-bob', 'dataset-beta');
  assert.equal(bobRead, null);
});

test('10. Cross-Tenant Isolation: InMemoryScoringRepository enforces dataset boundaries', async () => {
  const repo = new InMemoryScoringRepository();
  repo.setDatasetOwner('dataset-gamma', 'user-alice');

  // Alice succeeds
  await assert.doesNotReject(async () => {
    await repo.assertOwnedDataset('user-alice', 'dataset-gamma');
  });

  // Bob fails
  await assert.rejects(
    async () => {
      await repo.assertOwnedDataset('user-bob', 'dataset-gamma');
    },
    /not found or not owned by user/
  );

  // Bob gets empty scores
  const bobScores = await repo.getLeadScores('user-bob', 'dataset-gamma');
  assert.deepEqual(bobScores, []);
});

test('11. Cross-Tenant Isolation: InMemoryReportRepository enforces dataset boundaries', async () => {
  const repo = new InMemoryReportRepository();
  repo.setDatasetOwner('dataset-delta', 'user-alice');

  // Alice succeeds
  await assert.doesNotReject(async () => {
    await repo.assertOwnedDataset('user-alice', 'dataset-delta');
  });

  // Bob fails
  await assert.rejects(
    async () => {
      await repo.assertOwnedDataset('user-bob', 'dataset-delta');
    },
    /not found or not owned by user/
  );

  // Bob gets null report
  const bobReport = await repo.getReport('user-bob', 'dataset-delta');
  assert.equal(bobReport, null);
});

// -----------------------------------------------------------------------------
// 3. SSRF & URL HARDENING TESTS
// -----------------------------------------------------------------------------

test('12. SSRF Guard: assertPublicAddress blocks private, loopback, and metadata IPs', () => {
  const dangerousIPs = [
    '127.0.0.1',
    '127.0.1.1',
    '10.0.0.1',
    '10.254.254.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // AWS/GCP Instance Metadata Service
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ];

  for (const ip of dangerousIPs) {
    assert.throws(
      () => assertPublicAddress(ip),
      /The website resolves to a non-public network address\./,
      `IP ${ip} must be blocked by SSRF assertion`
    );
  }
});

test('13. SSRF Guard: assertPublicAddress permits public unicast addresses', () => {
  const safeIPs = [
    '8.8.8.8',
    '1.1.1.1',
    '142.250.190.46',
    '2607:f8b0:4005:805::200e',
  ];

  for (const ip of safeIPs) {
    assert.doesNotThrow(() => assertPublicAddress(ip), `IP ${ip} should be accepted`);
  }
});

test('14. URL Normalization: normalizeCompanyHomepage rejects unsafe schemes and raw IPs', () => {
  assert.throws(() => normalizeCompanyHomepage('http://localhost'), /not a local or IP address/);
  assert.throws(() => normalizeCompanyHomepage('http://127.0.0.1'), /not a local or IP address/);
  assert.throws(() => normalizeCompanyHomepage('http://169.254.169.254'), /not a local or IP address/);
  assert.throws(() => normalizeCompanyHomepage('ftp://example.com'), /valid public company domain/);
  assert.throws(() => normalizeCompanyHomepage('example.com:8080'), /public HTTPS/);
  assert.throws(() => normalizeCompanyHomepage('user:pass@example.com'), /valid public company domain/);
});

// -----------------------------------------------------------------------------
// 4. CSV FORMULA INJECTION HARDENING
// -----------------------------------------------------------------------------

test('15. CSV Injection: sanitizeCsvCell neutralizes dangerous spreadsheet trigger characters', () => {
  const dangerousCells = [
    '=HYPERLINK("http://attacker.com","Click")',
    '+cmd|"/c calc"!A0',
    '-2+3+cmd|"/c calc"!A0',
    '@SUM(A1:A10)',
    '\t=1+1',
    '\r=cmd',
  ];

  for (const cell of dangerousCells) {
    const sanitized = sanitizeCsvCell(cell);
    assert.ok(sanitized.startsWith(`"'`), `Formula injection cell "${cell}" must be prepended with "'`);
  }

  // Benign alphanumeric text is safely quoted
  assert.equal(sanitizeCsvCell('Acme Corp'), `"Acme Corp"`);
});

test('account export scopes every table to its owner and includes rows beyond the Supabase page limit', async () => {
  const leads = Array.from({ length: 1001 }, (_, index) => ({ id: `lead-${index}`, owner_user_id: 'owner-a' }));
  const visited: string[] = [];
  const client = {
    from(table: string) {
      visited.push(table);
      return {
        select(_columns: string) {
          return {
            eq(column: string, value: string) {
              if (table === 'waitlist') {
                assert.equal(column, 'email');
                assert.equal(value, 'owner@example.com');
                return Promise.resolve({ data: [], error: null });
              }
              assert.equal(column, table === 'subscriptions' || table === 'usage' ? 'user_id' : 'owner_user_id');
              assert.equal(value, 'owner-a');
              return {
                order(_sort: string) {
                  return {
                    async range(start: number, end: number) {
                      return { data: table === 'leads' ? leads.slice(start, end + 1) : [], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    auth: { admin: { async getUserById(id: string) {
      assert.equal(id, 'owner-a');
      return { data: { user: { id } }, error: null };
    } } },
  } as unknown as SupabaseClient;
  const archive = await exportAccountData(client, 'owner-a', 'owner@example.com');
  assert.equal(archive.tables.leads.length, 1001);
  assert.ok(visited.includes('lead_contacts'));
  assert.ok(visited.includes('subscriptions'));
  assert.ok(visited.includes('usage'));
  assert.ok(visited.includes('waitlist'));
});

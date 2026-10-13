import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPublicAddress,
  clearWebsiteEnrichmentCachesForTests,
  enrichFromPublicWebsite,
  normalizeCompanyHomepage,
  type HttpRequester,
} from '../websiteEnrichment';

const PUBLIC_IP = { address: '93.184.216.34', family: 4 };
const mockPublicResolver = async () => [PUBLIC_IP];

test('normalizeCompanyHomepage rejects empty, malformed, non-HTTPS, or non-domain strings', () => {
  assert.throws(() => normalizeCompanyHomepage(''), /valid public company domain/);
  assert.throws(() => normalizeCompanyHomepage('   '), /valid public company domain/);
  assert.throws(() => normalizeCompanyHomepage('invalid domain with spaces'), /valid public company domain/);
  assert.throws(() => normalizeCompanyHomepage('ftp://example.com'), /valid public company domain/);
  assert.throws(() => normalizeCompanyHomepage('example.com:8080'), /public HTTPS/);
  assert.throws(() => normalizeCompanyHomepage('user:pass@example.com'), /valid public company domain/);
});

test('normalizeCompanyHomepage rejects localhost and IP addresses directly in URL', () => {
  assert.throws(() => normalizeCompanyHomepage('localhost'), /not a local or IP address/);
  assert.throws(() => normalizeCompanyHomepage('127.0.0.1'), /not a local or IP address/);
  assert.throws(() => normalizeCompanyHomepage('10.0.0.1'), /not a local or IP address/);
  assert.throws(() => normalizeCompanyHomepage('192.168.1.1'), /not a local or IP address/);
  assert.throws(() => normalizeCompanyHomepage('8.8.8.8'), /not a local or IP address/);
});

test('normalizeCompanyHomepage properly normalizes legitimate public domains', () => {
  const url1 = normalizeCompanyHomepage('acme.io');
  assert.equal(url1.href, 'https://acme.io/');
  const url2 = normalizeCompanyHomepage('https://SUB.DOMAIN.EXAMPLE.COM/');
  assert.equal(url2.href, 'https://sub.domain.example.com/');
});

test('assertPublicAddress strictly blocks loopback, private, link-local, and IPv4-mapped addresses', () => {
  assert.throws(() => assertPublicAddress('invalid-ip'), /invalid IP address/);
  assert.throws(() => assertPublicAddress('127.0.0.1'), /non-public network address/);
  assert.throws(() => assertPublicAddress('127.0.0.254'), /non-public network address/);
  assert.throws(() => assertPublicAddress('::1'), /non-public network address/);
  assert.throws(() => assertPublicAddress('10.0.0.1'), /non-public network address/);
  assert.throws(() => assertPublicAddress('172.16.0.1'), /non-public network address/);
  assert.throws(() => assertPublicAddress('192.168.1.1'), /non-public network address/);
  assert.throws(() => assertPublicAddress('169.254.169.254'), /non-public network address/);
  assert.throws(() => assertPublicAddress('::ffff:127.0.0.1'), /non-public network address/);
  assert.throws(() => assertPublicAddress('::ffff:169.254.169.254'), /non-public network address/);

  // Must not throw for public unicast addresses
  assert.doesNotThrow(() => assertPublicAddress('93.184.216.34'));
  assert.doesNotThrow(() => assertPublicAddress('2606:2800:220:1:248:1893:25c8:1946'));
});

test('enrichFromPublicWebsite blocks DNS resolution to private addresses (SSRF guard)', async () => {
  clearWebsiteEnrichmentCachesForTests();
  const privateResolver = async () => [{ address: '169.254.169.254', family: 4 }];
  const result = await enrichFromPublicWebsite('metadata-leak.example', {
    resolver: privateResolver,
  });
  assert.equal(result.status, 'failed');
  assert.match(result.reason || '', /non-public network address/i);
});

test('enrichFromPublicWebsite successfully extracts public website HTML and headings', async () => {
  clearWebsiteEnrichmentCachesForTests();
  const mockRequester: HttpRequester = async (url) => {
    if (url.pathname === '/robots.txt') {
      return {
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: Buffer.from('User-agent: *\nAllow: /\n'),
      };
    }
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: Buffer.from(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Acme Cloud Intelligence | Automated SaaS</title>
            <meta name="description" content="Acme provides institutional-grade cloud optimization and automated workflows.">
          </head>
          <body>
            <h1>Enterprise Automation</h1>
            <h2>Why Fast-Growing Teams Choose Acme</h2>
            <main>
              <p>Acme automates complex business logic for high-growth tech companies worldwide.</p>
              <p>Deploy secure continuous integration pipelines with mathematically proven auditability.</p>
            </main>
          </body>
        </html>
      `),
    };
  };

  const result = await enrichFromPublicWebsite('acme-cloud.example', {
    resolver: mockPublicResolver,
    requester: mockRequester,
  });

  assert.equal(result.status, 'fetched');
  assert.equal(result.sourceUrl, 'https://acme-cloud.example/');
  assert.equal(result.title, 'Acme Cloud Intelligence | Automated SaaS');
  assert.equal(result.metaDescription, 'Acme provides institutional-grade cloud optimization and automated workflows.');
  assert.ok(result.headings.includes('Enterprise Automation'));
  assert.ok(result.headings.includes('Why Fast-Growing Teams Choose Acme'));
  assert.match(result.mainContent, /Acme automates complex business logic/);
  assert.deepEqual(result.pagesFetched, ['https://acme-cloud.example/']);
});

test('enrichFromPublicWebsite crawls and extracts same-origin about page when linked', async () => {
  clearWebsiteEnrichmentCachesForTests();
  const mockRequester: HttpRequester = async (url) => {
    if (url.pathname === '/robots.txt') {
      return {
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: Buffer.from('User-agent: *\nAllow: /\n'),
      };
    }
    if (url.pathname === '/about') {
      return {
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
        body: Buffer.from(`
          <html>
            <head><title>About Acme Inc</title></head>
            <body>
              <h2>Our Dedicated Leadership Team</h2>
              <article>
                <p>Founded in 2024, our engineers specialize in verifiable deterministic systems.</p>
              </article>
            </body>
          </html>
        `),
      };
    }
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: Buffer.from(`
        <html>
          <head><title>Acme Main</title></head>
          <body>
            <h1>Main Homepage</h1>
            <a href="https://acme-about.example/about">About Us</a>
            <p>Welcome to Acme Software's primary digital customer portal.</p>
          </body>
        </html>
      `),
    };
  };

  const result = await enrichFromPublicWebsite('acme-about.example', {
    resolver: mockPublicResolver,
    requester: mockRequester,
  });

  assert.equal(result.status, 'fetched');
  assert.ok(result.pagesFetched.includes('https://acme-about.example/'));
  assert.ok(result.pagesFetched.includes('https://acme-about.example/about'));
  assert.ok(result.headings.includes('Our Dedicated Leadership Team'));
  assert.match(result.mainContent, /Founded in 2024/);
});

test('enrichFromPublicWebsite fails on unsafe redirects or redirect loops', async () => {
  clearWebsiteEnrichmentCachesForTests();
  // 1. Unsafe redirect to unencrypted HTTP
  const unsafeRedirectRequester: HttpRequester = async (url) => {
    if (url.pathname === '/robots.txt') {
      return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: Buffer.from('Allow: /') };
    }
    return {
      statusCode: 301,
      headers: { location: 'http://insecure-redirect.example/' },
      body: Buffer.alloc(0),
    };
  };

  const resultUnsafe = await enrichFromPublicWebsite('redirect-unsafe.example', {
    resolver: mockPublicResolver,
    requester: unsafeRedirectRequester,
  });
  assert.equal(resultUnsafe.status, 'failed');
  assert.match(resultUnsafe.reason || '', /unsafe URL/i);

  clearWebsiteEnrichmentCachesForTests();
  // 2. Excessive redirect loop
  let redirectCount = 0;
  const loopRequester: HttpRequester = async (url) => {
    if (url.pathname === '/robots.txt') {
      return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: Buffer.from('Allow: /') };
    }
    redirectCount++;
    return {
      statusCode: 302,
      headers: { location: `https://redirect-loop.example/step-${redirectCount}` },
      body: Buffer.alloc(0),
    };
  };

  const resultLoop = await enrichFromPublicWebsite('redirect-loop.example', {
    resolver: mockPublicResolver,
    requester: loopRequester,
  });
  assert.equal(resultLoop.status, 'failed');
  assert.match(resultLoop.reason || '', /too many times/i);
});

test('enrichFromPublicWebsite enforces robots.txt restrictions and fails closed', async () => {
  clearWebsiteEnrichmentCachesForTests();
  const disallowedRequester: HttpRequester = async (url) => {
    if (url.pathname === '/robots.txt') {
      return {
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: Buffer.from('User-agent: *\nDisallow: /\n'),
      };
    }
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: Buffer.from('<html><body><p>This should never be crawled.</p></body></html>'),
    };
  };

  const resultDisallowed = await enrichFromPublicWebsite('disallowed-site.example', {
    resolver: mockPublicResolver,
    requester: disallowedRequester,
  });
  assert.equal(resultDisallowed.status, 'failed');
  assert.match(resultDisallowed.reason || '', /robots\.txt does not permit access/i);
});

test('enrichFromPublicWebsite handles timeouts, oversized responses, and non-HTML content gracefully', async () => {
  clearWebsiteEnrichmentCachesForTests();

  // 1. Timeout
  const timeoutRequester: HttpRequester = async (url) => {
    if (url.pathname === '/robots.txt') {
      return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: Buffer.from('Allow: /') };
    }
    throw new Error('The website request timed out.');
  };
  const resultTimeout = await enrichFromPublicWebsite('timeout-site.example', {
    resolver: mockPublicResolver,
    requester: timeoutRequester,
  });
  assert.equal(resultTimeout.status, 'failed');
  assert.match(resultTimeout.reason || '', /timed out/i);

  clearWebsiteEnrichmentCachesForTests();

  // 2. Oversized response
  const oversizedRequester: HttpRequester = async (url) => {
    if (url.pathname === '/robots.txt') {
      return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: Buffer.from('Allow: /') };
    }
    throw new Error('The website response exceeded the 1 MB safety limit.');
  };
  const resultOversized = await enrichFromPublicWebsite('oversized-site.example', {
    resolver: mockPublicResolver,
    requester: oversizedRequester,
  });
  assert.equal(resultOversized.status, 'failed');
  assert.match(resultOversized.reason || '', /1 MB safety limit/i);

  clearWebsiteEnrichmentCachesForTests();

  // 3. Non-HTML content
  const nonHtmlRequester: HttpRequester = async (url) => {
    if (url.pathname === '/robots.txt') {
      return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: Buffer.from('Allow: /') };
    }
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/pdf' },
      body: Buffer.from('%PDF-1.4 binary data'),
    };
  };
  const resultNonHtml = await enrichFromPublicWebsite('pdf-site.example', {
    resolver: mockPublicResolver,
    requester: nonHtmlRequester,
  });
  assert.equal(resultNonHtml.status, 'failed');
  assert.match(resultNonHtml.reason || '', /did not return HTML/i);
});

test('enrichFromPublicWebsite honors the enabled: false flag immediately', async () => {
  clearWebsiteEnrichmentCachesForTests();
  const result = await enrichFromPublicWebsite('disabled-feature.example', {
    enabled: false,
  });
  assert.equal(result.status, 'disabled');
  assert.equal(result.sourceUrl, null);
  assert.match(result.reason || '', /disabled/i);
});

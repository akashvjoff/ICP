import { lookup } from 'node:dns/promises';
import type { IncomingHttpHeaders } from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import * as cheerio from 'cheerio';

export const WEBSITE_LIMITS = {
  timeoutMs: 8_000,
  maxResponseBytes: 1_000_000,
  maxExtractedCharacters: 8_000,
  maxRedirects: 3,
  cacheTtlMs: 60 * 60 * 1000,
  domainThrottleMs: 5_000,
  maxConcurrency: 2,
} as const;

export interface WebsiteEvidence {
  status: 'fetched' | 'failed' | 'disallowed' | 'disabled';
  sourceUrl: string | null;
  fetchedAt: string | null;
  title: string | null;
  metaDescription: string | null;
  headings: string[];
  mainContent: string;
  pagesFetched: string[];
  reason?: string;
}

type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
type HtmlResponse = { url: URL; html: string; contentType: string };

const resultCache = new Map<string, { expiresAt: number; value: WebsiteEvidence }>();
const robotsCache = new Map<string, { expiresAt: number; text: string | null }>();
const lastDomainFetch = new Map<string, number>();
let activeRequests = 0;
const concurrencyQueue: Array<() => void> = [];

export type HttpRequester = (url: URL, pinned: { address: string; family: number }) => Promise<{
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}>;

export function assertPublicAddress(address: string): void {
  if (!isIP(address)) throw new Error('The hostname resolved to an invalid IP address.');
  const parsed = ipaddr.parse(address);
  const normalized = parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()
    ? (parsed as ipaddr.IPv6).toIPv4Address()
    : parsed;
  if (normalized.range() !== 'unicast') {
    throw new Error('The website resolves to a non-public network address.');
  }
}

export function normalizeCompanyHomepage(domain: string): URL {
  const trimmed = domain.trim();
  if (!trimmed || trimmed.length > 253) {
    throw new Error('Enter a valid public company domain.');
  }
  const withoutScheme = trimmed.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!withoutScheme || /[\s/@\\]/.test(withoutScheme)) {
    throw new Error('Enter a valid public company domain.');
  }
  const candidate = new URL(`https://${withoutScheme}`);
  if (candidate.protocol !== 'https:' || candidate.username || candidate.password || candidate.port) {
    throw new Error('Only a public HTTPS company homepage can be enriched.');
  }
  const hostname = candidate.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || !hostname.includes('.') || isIP(hostname)) {
    throw new Error('Enter a valid public company domain, not a local or IP address.');
  }
  candidate.hostname = hostname;
  candidate.pathname = '/';
  candidate.search = '';
  candidate.hash = '';
  return candidate;
}

async function resolvePublic(hostname: string, resolver: Resolver): Promise<{ address: string; family: number }> {
  const addresses = await resolver(hostname);
  if (!addresses.length) throw new Error('The company domain did not resolve to a public address.');
  addresses.forEach(({ address }) => assertPublicAddress(address));
  return addresses[0];
}

function requestOnce(url: URL, pinned: { address: string; family: number }): Promise<{
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      timeout: WEBSITE_LIMITS.timeoutMs,
      headers: {
        'User-Agent': 'ICP.MODE public company profile fetcher/1.0 (+respect robots.txt)',
        Accept: 'text/html,application/xhtml+xml;q=0.9',
      },
      lookup: ((_hostname: string, _options: unknown, callback: (...args: unknown[]) => void) => {
        callback(null, pinned.address, pinned.family);
      }) as https.RequestOptions['lookup'],
      servername: url.hostname,
    }, (response) => {
      const chunks: Buffer[] = [];
      let received = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += buffer.length;
        if (received > WEBSITE_LIMITS.maxResponseBytes) {
          request.destroy(new Error('The website response exceeded the 1 MB safety limit.'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => resolve({
        statusCode: response.statusCode || 0,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('The website request timed out.')));
    request.on('error', reject);
  });
}

async function safeGet(
  initialUrl: URL,
  resolver: Resolver,
  requester: HttpRequester = requestOnce,
  maxRedirects = WEBSITE_LIMITS.maxRedirects,
): Promise<HtmlResponse> {
  let current = new URL(initialUrl.href);
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    if (current.protocol !== 'https:' || current.username || current.password || current.port) {
      throw new Error('Website redirected to an unsafe URL.');
    }
    if (!await robotsPermit(current, resolver, requester)) {
      throw new Error('robots.txt does not permit access to this page or could not be checked.');
    }
    const pinned = await resolvePublic(current.hostname, resolver);
    const response = await requester(current, pinned);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (!location || redirects === maxRedirects) throw new Error('Website redirected too many times.');
      current = new URL(location, current);
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Website returned HTTP ${response.statusCode}.`);
    }
    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('The company website did not return HTML content.');
    }
    return { url: current, html: response.body.toString('utf8'), contentType };
  }
  throw new Error('Website redirect validation failed.');
}

function parseRobots(text: string, path: string): boolean {
  let applies = false;
  const rules: Array<{ allow: boolean; path: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.split('#')[0].trim();
    const separator = clean.indexOf(':');
    if (separator < 0) continue;
    const key = clean.slice(0, separator).trim().toLowerCase();
    const value = clean.slice(separator + 1).trim();
    if (key === 'user-agent') applies = value === '*' || /icp\.mode/i.test(value);
    else if (applies && (key === 'allow' || key === 'disallow') && value) {
      rules.push({ allow: key === 'allow', path: value.replace(/\*.*$/, '') });
    }
  }
  const matching = rules.filter((rule) => path.startsWith(rule.path)).sort((a, b) => b.path.length - a.path.length)[0];
  return matching?.allow ?? true;
}

async function robotsPermit(url: URL, resolver: Resolver, requester: HttpRequester = requestOnce): Promise<boolean> {
  const origin = url.origin;
  let cached = robotsCache.get(origin);
  if (!cached || cached.expiresAt < Date.now()) {
    try {
      const robotsUrl = new URL('/robots.txt', origin);
      const pinned = await resolvePublic(robotsUrl.hostname, resolver);
      const response = await requester(robotsUrl, pinned);
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      cached = {
        expiresAt: Date.now() + WEBSITE_LIMITS.cacheTtlMs,
        text: response.statusCode === 404 ? '' :
          ([200].includes(response.statusCode) && response.body.length <= 128_000 && !contentType.includes('html')
            ? response.body.toString('utf8')
            : null),
      };
      robotsCache.set(origin, cached);
    } catch (err) {
      if (err instanceof Error && err.message.includes('non-public network address')) {
        throw err;
      }
      // Fail closed when access permission cannot be checked.
      return false;
    }
  }
  if (cached.text === null) return false;
  return parseRobots(cached.text, `${url.pathname}${url.search}`);
}

function extractHtml(html: string): { title: string | null; metaDescription: string | null; headings: string[]; mainContent: string } {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, svg, canvas, nav, footer, header, aside, form, button, input, select, textarea, [aria-hidden="true"], [role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  const title = $('title').first().text().trim().slice(0, 300) || null;
  const metaDescription = $('meta[name="description" i]').attr('content')?.trim().slice(0, 600) || null;
  const headings = $('h1, h2, h3').toArray().map((element) => $(element).text().replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30);
  const main = $('main, [role="main"], article').first();
  const source = main.length ? main : $('body');
  const mainContent = source.find('p, li').toArray()
    .map((element) => $(element).text().replace(/\s+/g, ' ').trim())
    .filter((text) => text.length >= 35)
    .filter((text, index, all) => all.indexOf(text) === index)
    .join('\n')
    .slice(0, WEBSITE_LIMITS.maxExtractedCharacters);
  return { title, metaDescription, headings, mainContent };
}

function findAboutPage(homepage: HtmlResponse): URL | null {
  const $ = cheerio.load(homepage.html);
  const anchors = $('a[href]').toArray();
  for (const anchor of anchors) {
    const text = $(anchor).text().trim().toLowerCase();
    const href = String($(anchor).attr('href') || '').trim();
    if (!/(^|\b)(about|about us|our company|who we are)(\b|$)/i.test(text) && !/\/about(?:-us)?(?:\/|$|[?#])/i.test(href)) continue;
    try {
      const target = new URL(href, homepage.url);
      if (target.origin === homepage.url.origin && target.protocol === 'https:' && !target.username && !target.password) {
        target.hash = '';
        return target;
      }
    } catch {
      // Ignore malformed links; never broaden discovery beyond same origin.
    }
  }
  return null;
}

async function acquireDomainSlot(hostname: string): Promise<() => void> {
  if (activeRequests >= WEBSITE_LIMITS.maxConcurrency) await new Promise<void>((resolve) => concurrencyQueue.push(resolve));
  activeRequests += 1;
  const wait = Math.max(0, WEBSITE_LIMITS.domainThrottleMs - (Date.now() - (lastDomainFetch.get(hostname) || 0)));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastDomainFetch.set(hostname, Date.now());
  return () => {
    activeRequests -= 1;
    concurrencyQueue.shift()?.();
  };
}

export async function enrichFromPublicWebsite(
  domain: string,
  options: { resolver?: Resolver; requester?: HttpRequester; enabled?: boolean } = {},
): Promise<WebsiteEvidence> {
  const homepage = normalizeCompanyHomepage(domain);
  if (options.enabled === false) {
    return { status: 'disabled', sourceUrl: null, fetchedAt: null, title: null, metaDescription: null, headings: [], mainContent: '', pagesFetched: [], reason: 'Public website retrieval is disabled.' };
  }
  const cached = resultCache.get(homepage.href);
  if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.value);

  const resolver = options.resolver || (async (hostname: string) => lookup(hostname, { all: true, verbatim: true }));
  const requester = options.requester || requestOnce;
  const release = await acquireDomainSlot(homepage.hostname);
  try {
    const fetchedAt = new Date().toISOString();
    const home = await safeGet(homepage, resolver, requester);
    const homeExtract = extractHtml(home.html);
    const aboutUrl = findAboutPage(home);
    let aboutExtract: ReturnType<typeof extractHtml> | null = null;
    let aboutFinalUrl: URL | null = null;
    if (aboutUrl && aboutUrl.origin === home.url.origin && await robotsPermit(aboutUrl, resolver, requester)) {
      try {
        const about = await safeGet(aboutUrl, resolver, requester);
        if (about.url.origin === home.url.origin) {
          aboutFinalUrl = about.url;
          aboutExtract = extractHtml(about.html);
        }
      } catch {
        // Homepage evidence is sufficient when the optional About page fails.
      }
    }

    const content = [homeExtract.mainContent, aboutExtract?.mainContent || '']
      .filter(Boolean)
      .join('\n')
      .slice(0, WEBSITE_LIMITS.maxExtractedCharacters);
    const evidence: WebsiteEvidence = {
      status: 'fetched',
      sourceUrl: home.url.href,
      fetchedAt,
      title: homeExtract.title,
      metaDescription: homeExtract.metaDescription,
      headings: [...homeExtract.headings, ...(aboutExtract?.headings || [])].slice(0, 40),
      mainContent: content,
      pagesFetched: [home.url.href, ...(aboutFinalUrl ? [aboutFinalUrl.href] : [])],
    };
    resultCache.set(homepage.href, { expiresAt: Date.now() + WEBSITE_LIMITS.cacheTtlMs, value: evidence });
    return evidence;
  } catch (error) {
    return {
      status: 'failed',
      sourceUrl: null,
      fetchedAt: null,
      title: null,
      metaDescription: null,
      headings: [],
      mainContent: '',
      pagesFetched: [],
      reason: error instanceof Error ? error.message : 'Website retrieval failed.',
    };
  } finally {
    release();
  }
}

export function clearWebsiteEnrichmentCachesForTests(): void {
  resultCache.clear();
  robotsCache.clear();
  lastDomainFetch.clear();
}

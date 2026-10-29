import * as Sentry from '@sentry/react';
import { scrubSentryEvent } from './sentryScrub';

declare const __SENTRY_RELEASE__: string;

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    release: __SENTRY_RELEASE__ || undefined,
    // Sentry v11 uses dataCollection instead of sendDefaultPii: false.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    beforeSend: event => scrubSentryEvent(event),
  });
}

const publicPaths = new Set(['/', '/auth', '/demo', '/about', '/privacy', '/terms', '/pricing', '/refund-policy', '/contact', '/guides/ideal-customer-profile-from-leads']);

function loadClarity(): void {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
  if (!projectId || document.getElementById('microsoft-clarity')) return;
  type ClarityFunction = ((...args: unknown[]) => void) & { q?: unknown[][] };
  const clarity = window as Window & { clarity?: ClarityFunction };
  if (!clarity.clarity) {
    const queue: unknown[][] = [];
    const stub: ClarityFunction = (...args) => { queue.push(args); };
    stub.q = queue;
    clarity.clarity = stub;
  }
  const script = document.createElement('script');
  script.id = 'microsoft-clarity';
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
  document.head.appendChild(script);
}

export function syncPublicAnalytics(path: string): void {
  if (!publicPaths.has(path) || import.meta.env.DEV) return;
  loadClarity();
  const analytics = window as Window & { sa_pageview?: (path: string) => void };
  if (analytics.sa_pageview) {
    analytics.sa_pageview(path);
    return;
  }
  if (document.getElementById('simple-analytics')) return;
  const script = document.createElement('script');
  script.id = 'simple-analytics';
  script.async = true;
  script.dataset.autoCollect = 'false';
  script.src = 'https://scripts.simpleanalyticscdn.com/latest.js';
  script.onload = () => {
    const currentPath = window.location.pathname;
    if (publicPaths.has(currentPath)) analytics.sa_pageview?.(currentPath);
  };
  document.body.appendChild(script);
}

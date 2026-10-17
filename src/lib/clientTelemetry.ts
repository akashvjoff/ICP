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

const publicPaths = new Set(['/', '/auth', '/demo', '/about', '/privacy', '/terms', '/pricing', '/refund-policy', '/contact']);

export function syncPublicAnalytics(path: string): void {
  if (!publicPaths.has(path) || import.meta.env.DEV) return;
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

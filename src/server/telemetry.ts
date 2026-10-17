import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { scrubSentryEvent } from '../lib/sentryScrub';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: process.env.RENDER_GIT_COMMIT || undefined,
    // Sentry v11 uses dataCollection instead of sendDefaultPii: false.
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
      genAI: { inputs: false, outputs: false }, databaseQueryData: false, queues: false,
      stackFrameVariables: false,
    },
    beforeSend: event => scrubSentryEvent(event),
  });
}

export function captureServerFailure(error: unknown, tags: Record<string, string>): void {
  if (!process.env.SENTRY_DSN) return;
  // Provider messages can contain prompts, account names, or row content.
  const safeError = new Error(error instanceof Error ? error.name : 'ServerFailure');
  Sentry.captureException(safeError, { tags });
}

export function trackServerEvent(event: 'signup_completed' | 'dataset_uploaded' | 'analysis_completed' | 'export_clicked' | 'waitlist_joined'): void {
  if (process.env.NODE_ENV !== 'production') return;
  void fetch('https://queue.simpleanalyticscdn.com/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'FiguredIt/1.0 (+https://figuredit.in/)' },
    body: JSON.stringify({ type: 'event', hostname: 'figuredit.in', event, ua: 'FiguredIt/1.0' }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
}

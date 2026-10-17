const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g;
const privateKey = /email|phone|mobile|csv|row|file|upload|body|content|password|token|authorization|cookie|contact/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[Filtered]';
  if (typeof value === 'string') {
    if ((value.includes('\n') && (value.includes(',') || value.includes(';'))) || value.split(',').length >= 3) return '[CSV content filtered]';
    return value.replace(emailPattern, '[email]').replace(phonePattern, '[phone]');
  }
  if (Array.isArray(value)) return value.map(item => scrub(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, privateKey.test(key) ? '[Filtered]' : scrub(item, depth + 1)]));
  }
  return value;
}

export function scrubSentryEvent<T extends object>(event: T): T {
  const cleaned = scrub(event) as T & Record<string, unknown>;
  delete cleaned.user;
  if (cleaned.request && typeof cleaned.request === 'object') {
    const request = cleaned.request as Record<string, unknown>;
    delete request.data;
    delete request.headers;
    delete request.cookies;
    if (typeof request.url === 'string') request.url = request.url.split('?')[0];
  }
  return cleaned;
}

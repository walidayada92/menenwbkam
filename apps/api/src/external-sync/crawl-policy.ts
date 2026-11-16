export type BackoffKind =
  | 'BLOCKED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'CHALLENGE'
  | 'COOLDOWN'
  | 'BUDGET';
export class StoreBackoffError extends Error {
  constructor(
    message: string,
    public retryAt: Date,
    public kind: BackoffKind,
    public deferred = false,
  ) {
    super(message);
  }
}
function setting(key: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[key] ?? fallback);
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : fallback;
}
export function crawlSettings() {
  return {
    minDelayMs: setting('EXTERNAL_CRAWL_MIN_DELAY_MS', 5000, 2000, 60000),
    jitterMs: setting('EXTERNAL_CRAWL_JITTER_MS', 3000, 0, 30000),
    hourlyBudget: setting('EXTERNAL_CRAWL_HOURLY_BUDGET', 120, 1, 10000),
    dailyBudget: setting('EXTERNAL_CRAWL_DAILY_BUDGET', 1000, 1, 100000),
  };
}
export function requestSpacing(minimum: number) {
  const settings = crawlSettings();
  return (
    Math.max(settings.minDelayMs, minimum) +
    Math.floor(Math.random() * (settings.jitterMs + 1))
  );
}
export function retryAfter(
  value: string | null,
  now = Date.now(),
): Date | null {
  if (!value) return null;
  const time = /^\d+$/.test(value.trim())
    ? now + Number(value.trim()) * 1000
    : Date.parse(value);
  return Number.isFinite(time) && time > now && time <= 8640000000000000
    ? new Date(time)
    : null;
}
export function cooldownDeadline(
  kind: BackoffKind,
  failures = 1,
  header: string | null = null,
  now = Date.now(),
) {
  const minimum =
    kind === 'BLOCKED' || kind === 'CHALLENGE'
      ? 24 * 3600000
      : kind === 'RATE_LIMITED'
        ? 3600000
        : 15 * 60000;
  const delay = Math.min(
    7 * 24 * 3600000,
    minimum * 2 ** Math.min(8, Math.max(0, failures - 1)),
  );
  return new Date(
    Math.max(now + delay, retryAfter(header, now)?.getTime() || 0),
  );
}
export function isAccessChallenge(body: string) {
  return /<form\b[^>]*action=["'][^"']*validateCaptcha|id=["']captchacharacters["']|<title[^>]*>\s*(?:robot check|access denied|just a moment|verify you are human)\b/i.test(
    body,
  );
}
export function nextCrawl(intervalMinutes: number, now = Date.now()) {
  const interval = intervalMinutes * 60000;
  return new Date(
    now +
      interval +
      Math.floor(Math.random() * Math.min(interval * 0.15, 3600000)),
  );
}
export function hostRetryAt(
  row: {
    cooldownUntil: Date | null;
    hourStartedAt: Date;
    hourRequests: number;
    dayStartedAt: Date;
    dayRequests: number;
  },
  now = Date.now(),
) {
  const settings = crawlSettings();
  const until = Math.max(
    row.cooldownUntil?.getTime() || 0,
    row.hourRequests >= settings.hourlyBudget
      ? row.hourStartedAt.getTime() + 3600000
      : 0,
    row.dayRequests >= settings.dailyBudget
      ? row.dayStartedAt.getTime() + 86400000
      : 0,
  );
  return until > now ? new Date(until) : null;
}
export function backoffDetails(error: unknown): {
  retryAt?: string;
  backoffKind?: BackoffKind;
  deferred?: boolean;
} {
  return error instanceof StoreBackoffError
    ? {
        retryAt: error.retryAt.toISOString(),
        backoffKind: error.kind,
        deferred: error.deferred,
      }
    : {};
}

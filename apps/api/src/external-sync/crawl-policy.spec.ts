import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cooldownDeadline,
  hostRetryAt,
  isAccessChallenge,
  nextCrawl,
  requestSpacing,
  retryAfter,
} from './crawl-policy';
describe('Polite periodic crawl policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it('paces requests conservatively and never shortens robots delays', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(requestSpacing(2000)).toBe(5000);
    expect(requestSpacing(12000)).toBe(12000);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(requestSpacing(2000)).toBeGreaterThan(7900);
  });
  it('honors both Retry-After formats and rejects invalid/past values', () => {
    const now = Date.parse('2026-11-10T10:00:00Z');
    expect(retryAfter('3600', now)?.toISOString()).toBe(
      '2026-11-10T11:00:00.000Z',
    );
    expect(
      retryAfter('Tue, 10 Nov 2026 12:00:00 GMT', now)?.toISOString(),
    ).toBe('2026-11-10T12:00:00.000Z');
    expect(retryAfter('bad', now)).toBeNull();
    expect(retryAfter('Tue, 10 Nov 2026 09:00:00 GMT', now)).toBeNull();
    expect(cooldownDeadline('RATE_LIMITED', 1, '7200', now).getTime()).toBe(
      now + 7200000,
    );
  });
  it('backs off for access blocks, overload and repeated rate limits', () => {
    expect(cooldownDeadline('BLOCKED', 1, null, 0).getTime()).toBe(86400000);
    expect(cooldownDeadline('CHALLENGE', 1, null, 0).getTime()).toBe(86400000);
    expect(cooldownDeadline('UNAVAILABLE', 1, null, 0).getTime()).toBe(900000);
    expect(cooldownDeadline('RATE_LIMITED', 3, null, 0).getTime()).toBe(
      4 * 3600000,
    );
  });
  it('recognizes actual challenges without treating normal product text as a challenge', () => {
    expect(isAccessChallenge('<title>Robot Check</title>')).toBe(true);
    expect(isAccessChallenge('<form action="/errors/validateCaptcha">')).toBe(
      true,
    );
    expect(
      isAccessChallenge('<title>Robot vacuum cleaner</title>captcha SDK'),
    ).toBe(false);
  });
  it('adds schedule jitter after the configured interval and pauses exhausted hosts', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(nextCrawl(60, 0).getTime()).toBe(3600000 + 270000);
    const row = {
      cooldownUntil: null,
      hourStartedAt: new Date(0),
      hourRequests: 120,
      dayStartedAt: new Date(0),
      dayRequests: 120,
    };
    expect(hostRetryAt(row, 1000)?.getTime()).toBe(3600000);
    expect(hostRetryAt(row, 3600001)).toBeNull();
  });
});

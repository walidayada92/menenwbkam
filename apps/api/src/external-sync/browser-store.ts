import { chromium } from 'playwright-core';
import { lookup } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import { Store, storeUrl, publicAddress } from './public-store';
import {
  cooldownDeadline,
  isAccessChallenge,
  StoreBackoffError,
} from './crawl-policy';

export function browserCollectionEnabled() {
  return process.env.EXTERNAL_BROWSER_ENABLED === 'true';
}

export function browserExecutable() {
  const configured = process.env.EXTERNAL_BROWSER_EXECUTABLE;
  if (configured) return configured;
  for (const path of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ])
    if (existsSync(path)) return path;
  throw new Error(
    'Set EXTERNAL_BROWSER_EXECUTABLE to an installed Chrome/Chromium executable',
  );
}

export async function renderStorePage(
  value: string,
  store: Store,
  signal: AbortSignal,
  throttle?: (
    host: string,
    delay: number,
    signal: AbortSignal,
  ) => Promise<void>,
  reportBackoff?: (
    host: string,
    kind: 'BLOCKED' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'CHALLENGE',
    retryAfter: string | null,
  ) => Promise<Date>,
) {
  signal.throwIfAborted();
  const url = storeUrl(value, store);
  const host = new URL(url).hostname;
  const browser = await chromium.launch({
    executablePath: browserExecutable(),
    headless: true,
    timeout: 15000,
    args: ['--disable-http2'],
  });
  const context = await browser.newContext({
    locale: /saudi-ar|ar-sa/.test(url) ? 'ar-SA' : 'en-SA',
    serviceWorkers: 'block',
    acceptDownloads: false,
  });
  let networkError: unknown;
  const abort = () => {
    void context.close().catch(() => {});
  };
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 60000);
  const publicHosts = new Set<string>();
  let requests = 0;
  try {
    await context.route('**/*', async (route) => {
      try {
        signal.throwIfAborted();
        const request = route.request();
        const target = new URL(request.url());
        if (
          !['https:'].includes(target.protocol) ||
          target.username ||
          target.password ||
          (target.port && target.port !== '443')
        )
          return await route.abort();
        if (request.isNavigationRequest()) {
          if (request.frame().parentFrame()) return await route.abort();
          storeUrl(target.toString(), store);
        }
        if (
          ['image', 'media', 'font'].includes(request.resourceType()) ||
          /(^|\.)(google-analytics\.com|googletagmanager\.com|doubleclick\.net|facebook\.net|mixpanel\.com)$/.test(
            target.hostname,
          )
        )
          return await route.abort();
        if (++requests > 400) throw new Error('Browser request limit exceeded');
        if (!publicHosts.has(target.hostname)) {
          const addresses = await lookup(target.hostname, { all: true });
          if (
            !addresses.length ||
            addresses.some(({ address }) => !publicAddress(address))
          )
            throw new Error('Non-public browser resource address');
          publicHosts.add(target.hostname);
        }
        // Throttle whole page navigations. Serializing every hydration request
        // prevents the storefront from ever finishing its product render.
        // Subresources have a separate bounded request budget above.
        if (request.isNavigationRequest()) await throttle?.(host, 5000, signal);
        await route.continue();
      } catch (error) {
        networkError = error;
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    if (!response) throw new Error('Browser returned no store response');
    const status = response.status();
    const pause = async (
      kind: 'BLOCKED' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'CHALLENGE',
    ) => {
      const retryAfter = response.headers()['retry-after'] || null;
      const deadline = reportBackoff
        ? await reportBackoff(host, kind, retryAfter)
        : cooldownDeadline(kind, 1, retryAfter);
      throw new StoreBackoffError(
        'Store blocked or challenged browser collection',
        deadline,
        kind,
      );
    };
    if (status === 403) await pause('BLOCKED');
    if (status === 429) await pause('RATE_LIMITED');
    if (status >= 500) await pause('UNAVAILABLE');
    if (status === 200) {
      // Give client-rendered product cards/structured data time to appear.
      const search = /\/search\/?|\/s\?|\/sr\?/.test(url);
      const selector =
        search && store === 'TRENDYOL'
          ? '.search-result-content a.product-card[href]'
          : search && store === 'EXTRA'
            ? '#product-lising-search-page a[href*="/p/"]'
            : search && store === 'NOON'
              ? 'main a[href*="/p/"]'
              : '[data-component-type="s-search-result"], a[href*="/product/"], script[type="application/ld+json"]';
      await page
        .waitForSelector(selector, { state: 'attached', timeout: 15000 })
        .catch(() => {});
    }
    const body = await page.content();
    if (isAccessChallenge(body) || /\/captcha|\/challenge/.test(page.url()))
      await pause('CHALLENGE');
    if (networkError) throw networkError;
    signal.throwIfAborted();
    if (Buffer.byteLength(body) > 4 * 1024 * 1024)
      throw new Error('Browser response exceeds 4 MB');
    return { status, body, resolvedUrl: storeUrl(page.url(), store) };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    await context.close().catch(() => {});
    await browser.close();
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  context: { route: vi.fn(), newPage: vi.fn(), close: vi.fn() },
  browser: { newContext: vi.fn(), close: vi.fn() },
  page: {
    goto: vi.fn(),
    waitForSelector: vi.fn(),
    content: vi.fn(),
    url: vi.fn(),
  },
}));
vi.mock('playwright-core', () => ({ chromium: { launch: mocks.launch } }));
import { renderStorePage } from './browser-store';
import { renderedSearchProducts } from './discovery';

describe('Browser store collection', () => {
  const url = 'https://www.extra.com/en-sa/search/?text=tv';
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('EXTERNAL_BROWSER_EXECUTABLE', 'test-chrome');
    mocks.launch.mockResolvedValue(mocks.browser);
    mocks.browser.newContext.mockResolvedValue(mocks.context);
    mocks.context.newPage.mockResolvedValue(mocks.page);
    mocks.context.close.mockResolvedValue(undefined);
    mocks.page.waitForSelector.mockResolvedValue(null);
    mocks.page.goto.mockResolvedValue({
      status: () => 200,
      headers: () => ({}),
    });
    mocks.page.content.mockResolvedValue('<html>Rendered</html>');
    mocks.page.url.mockReturnValue(url);
  });
  afterEach(() => vi.unstubAllEnvs());
  it('returns rendered HTML and closes its isolated browser', async () => {
    expect(
      await renderStorePage(url, 'EXTRA', new AbortController().signal),
    ).toMatchObject({ status: 200, body: '<html>Rendered</html>' });
    expect(mocks.context.route).toHaveBeenCalled();
    expect(mocks.context.close).toHaveBeenCalled();
    expect(mocks.browser.close).toHaveBeenCalled();
  });
  it('reports a challenge cooldown and closes the browser without attempting to solve it', async () => {
    mocks.page.content.mockResolvedValue('<title>Access denied</title>');
    const backoff = vi.fn().mockResolvedValue(new Date(Date.now() + 86400000));
    await expect(
      renderStorePage(
        url,
        'EXTRA',
        new AbortController().signal,
        undefined,
        backoff,
      ),
    ).rejects.toThrow('challenged');
    expect(backoff).toHaveBeenCalledWith('www.extra.com', 'CHALLENGE', null);
    expect(mocks.browser.close).toHaveBeenCalled();
  });
  it('refuses invalid store URLs and already cancelled requests before launching', async () => {
    await expect(
      renderStorePage(
        'https://evil.example',
        'EXTRA',
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    await expect(
      renderStorePage(url, 'EXTRA', AbortSignal.abort()),
    ).rejects.toThrow();
    expect(mocks.launch).not.toHaveBeenCalled();
  });
  it('extracts only in-scope result links, removes tracking, and ignores menu products', () => {
    const product = '/en-sa/tvs/samsung/p/12345';
    const result = renderedSearchProducts(
      `<nav><a href="/en-sa/gift/p/111">Gift</a></nav><div id="product-lising-search-page"><a href="${product}?ref=x">TV</a><a href="${product}">TV</a><a href="https://evil.example/en-sa/tv/p/99">Other</a></div>`,
      url,
      'EXTRA',
    );
    expect(result.products).toEqual(['https://www.extra.com' + product]);
    expect(() =>
      renderedSearchProducts('<main>Loading...</main>', url, 'EXTRA'),
    ).toThrow('No recognizable');
    expect(
      renderedSearchProducts(
        '<main><a href="/saudi-en/tv/N12345678/p/">TV</a></main>',
        'https://www.noon.com/saudi-en/search/?q=tv',
        'NOON',
      ).products,
    ).toEqual(['https://www.noon.com/saudi-en/tv/N12345678/p/']);
  });
});

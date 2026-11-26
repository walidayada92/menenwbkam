import { load } from 'cheerio';
import { Observation, storeUrl } from './public-store';

export function isAmazonIphoneDevice(title: string) {
  return (
    /iphone|[اآأ]يفون/i.test(title) &&
    !/\b(case|cover|protector|cable|charger|wallet|microphone|adapter|guide|book)\b|كفر|جراب|حافظة|شاحن|واقي|غطاء|حامل بطاقات|شاشة حماية|ميكروفون|محفظة|كابل|بطارية ماج|حماية.{0,30}الكاميرا/i.test(
      title,
    )
  );
}

export function amazonSearchProducts(
  html: string,
  options: { iphoneOnly?: boolean } = {},
) {
  const $ = load(html);
  const found = new Map<string, string>();
  $('[data-component-type="s-search-result"][data-asin]').each((_, element) => {
    const card = $(element),
      asin = card.attr('data-asin') || '';
    const title = card.find('h2').text().trim();
    if (
      !/^[A-Z0-9]{10}$/.test(asin) ||
      !title ||
      (options.iphoneOnly !== false && !isAmazonIphoneDevice(title))
    )
      return;
    const href = card
      .find('a[href*="/dp/"]')
      .toArray()
      .map((a) => $(a).attr('href')!)
      .find((value) => value.includes('/dp/' + asin));
    if (!href) return;
    const url = new URL(href, 'https://www.amazon.sa');
    url.pathname = url.pathname.slice(
      0,
      url.pathname.indexOf('/dp/' + asin) + 14,
    );
    url.search = '';
    url.hash = '';
    found.set(asin, storeUrl(url.toString(), 'AMAZON'));
  });
  return [...found.values()];
}

export function amazonNextSearchPage(
  html: string,
  currentUrl: string,
): string | null {
  const $ = load(html);
  if (
    $('form[action*="validateCaptcha"], #captchacharacters').length ||
    /robot check/i.test($('title').text())
  )
    throw new Error('Amazon search returned a CAPTCHA');
  const next = $(
    'a.s-pagination-next:not(.s-pagination-disabled), a[rel="next"]',
  ).first();
  if (!next.length) return null;
  const href = next.attr('href');
  if (!href) throw new Error('Amazon next-page link has no URL');
  const url = new URL(storeUrl(new URL(href, currentUrl).toString(), 'AMAZON'));
  const current = new URL(currentUrl);
  const page = Number(url.searchParams.get('page'));
  if (
    url.pathname !== '/s' ||
    !Number.isInteger(page) ||
    page <= Number(current.searchParams.get('page') || 1)
  )
    throw new Error('Amazon pagination did not advance to another search page');
  if (
    (url.searchParams.get('k') || current.searchParams.get('k')) !==
    current.searchParams.get('k')
  )
    throw new Error('Amazon pagination changed the search query');
  // Drop referral/session parameters so repeated URLs have a stable identity.
  const canonical = new URL('/s', current.origin);
  canonical.searchParams.set('k', current.searchParams.get('k') || 'iphone');
  canonical.searchParams.set('page', String(page));
  return canonical.toString();
}

export function parseAmazonProduct(html: string, url: string): Observation {
  storeUrl(url, 'AMAZON');
  const $ = load(html);
  if (
    $('form[action*="validateCaptcha"], #captchacharacters').length ||
    /robot check/i.test($('title').text())
  )
    throw new Error('Amazon returned a CAPTCHA; price was not checked');
  const title = $('#productTitle').text().trim();
  const asin = new URL(url).pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  if (!title || !asin) throw new Error('Amazon product title or ASIN missing');
  const pageAsin = $('input#ASIN').first().attr('value');
  if (pageAsin && pageAsin !== asin)
    throw new Error('Amazon page ASIN does not match the requested product');
  // Only the current main offer, never installments, recommendations, or crossed-out prices.
  const amounts = new Set<string>();
  $(
    '#corePrice_feature_div .apex-pricetopay-value .a-offscreen, #corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen',
  ).each((_, element) => {
    const text = $(element).text();
    if (!/SAR|ريال|ر\.س/i.test(text)) return;
    const number = text
      .replace(/[\u200e\u200f\u061c\s,]/g, '')
      .match(/\d+(?:\.\d+)?/)?.[0];
    if (
      number &&
      /^\d{1,10}(?:\.\d{1,2})?$/.test(number) &&
      Number(number) > 0 &&
      Number(number) < 10000000000
    )
      amounts.add(Number(number).toFixed(2));
  });
  if (amounts.size !== 1)
    throw new Error('Amazon main SAR price missing or ambiguous');
  const availabilityText = $('#availability')
    .clone()
    .find('script, style')
    .remove()
    .end()
    .text()
    .trim();
  const unavailable =
    /currently unavailable|out of stock|غير متوفر|غير متاح/i.test(
      availabilityText,
    );
  const available = /in stock|متوفر|متاح|only \d+ left/i.test(availabilityText);
  return {
    url,
    brand: /iphone|[اآأ]يفون/i.test(title) ? 'Apple' : null,
    itemCondition: /refurbished|renewed|مجدد|معاد تصنيعه/i.test(title)
      ? 'RefurbishedCondition'
      : /\bnew\b|جديد/i.test($('#condition').text())
        ? 'NewCondition'
        : null,
    title: title.slice(0, 1000),
    externalId: asin,
    price: [...amounts][0],
    currency: 'SAR',
    availability: unavailable
      ? 'OutOfStock'
      : available
        ? 'InStock'
        : 'UNKNOWN',
    stock: null,
  };
}

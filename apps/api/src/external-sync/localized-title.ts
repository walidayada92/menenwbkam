import { load } from 'cheerio';
import {
  Observation,
  parseProduct,
  PublicStoreClient,
  Store,
  storeUrl,
} from './public-store';
import { noonLocaleUrl, parseNoonProduct } from './noon';

export function localizedProductUrl(
  value: string,
  store: Store,
  locale: 'en' | 'ar',
) {
  const url = new URL(storeUrl(value, store));
  if (store === 'ALMANEA') {
    url.pathname = url.pathname.replace(/^\/en(?=\/)/, '');
    if (locale === 'en') url.pathname = '/en' + url.pathname;
  } else if (store === 'AMAZON') {
    url.searchParams.set('language', locale === 'en' ? 'en_AE' : 'ar_AE');
    url.searchParams.set('th', '1');
    url.searchParams.set('psc', '1');
  } else if (store === 'TRENDYOL') {
    url.pathname = url.pathname.replace(/^\/(en|ar)(?=\/)/, `/${locale}`);
  } else if (store === 'EXTRA') {
    url.pathname = url.pathname.replace(/^\/(en|ar)-sa(?=\/)/, `/${locale}-sa`);
  } else if (store === 'NOON') {
    return noonLocaleUrl(value, locale);
  } else
    throw new Error(
      'Localized product pages are not configured for this store',
    );
  return url.toString();
}

export function sourceTitle(
  html: string,
  url: string,
  store: Store,
  expectedId: string | null,
  locale: 'en' | 'ar',
) {
  const $ = load(html);
  let title: string;
  if (store === 'AMAZON') {
    if (!expectedId || $('input#ASIN').first().attr('value') !== expectedId)
      throw new Error('Localized Amazon product identity mismatch');
    title = $('#productTitle').text().trim();
  } else {
    const product =
      store === 'NOON' ? parseNoonProduct(html, url) : parseProduct(html, url);
    if (expectedId && product.externalId !== expectedId)
      throw new Error('Localized product identity mismatch');
    title = product.title;
  }
  if (
    !title ||
    (locale === 'en' && /[\u0600-\u06ff]/.test(title)) ||
    (locale === 'ar' && !/[\u0600-\u06ff]/.test(title))
  )
    throw new Error('Store did not return the requested title language');
  return title.slice(0, 1000);
}

export async function localizedTitles(
  client: PublicStoreClient,
  store: Store,
  observation: Observation,
) {
  const baseLocale = /[\u0600-\u06ff]/.test(observation.title) ? 'ar' : 'en';
  const locale = baseLocale === 'ar' ? 'en' : 'ar';
  const url = localizedProductUrl(observation.url, store, locale);
  const response = await client.get(url, 0, locale);
  if (response.status !== 200)
    throw new Error(`Localized page returned HTTP ${response.status}`);
  const title = sourceTitle(
    response.body,
    response.resolvedUrl || url,
    store,
    observation.externalId,
    locale,
  );
  return {
    ...(baseLocale === 'ar'
      ? { titleAr: observation.title, urlAr: observation.url }
      : { titleEn: observation.title, urlEn: observation.url }),
    ...(locale === 'en'
      ? { titleEn: title, urlEn: response.resolvedUrl || url }
      : { titleAr: title, urlAr: response.resolvedUrl || url }),
  };
}

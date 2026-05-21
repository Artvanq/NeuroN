import { contentLocales, ORIGINAL_LOCALE } from './contentLocales';

/** UI interface languages (same set as content translation, except Original). */
export const uiLocales = contentLocales.filter((l) => l.code !== ORIGINAL_LOCALE);

export const uiLocaleCodes = uiLocales.map((l) => l.code);

export const rtlLocales = new Set(['ar', 'he', 'fa']);

export function getUiLocaleMeta(code) {
  return uiLocales.find((l) => l.code === code) || null;
}

export function inferBrowserUiLocale() {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language?.slice(0, 2)?.toLowerCase();
  const map = {
    uk: 'uk', ua: 'uk', ru: 'ru', de: 'de', fr: 'fr', es: 'es', pt: 'pt', it: 'it',
    pl: 'pl', nl: 'nl', tr: 'tr', vi: 'vi', id: 'id', th: 'th', hi: 'hi', zh: 'zh',
    ja: 'ja', ko: 'ko', ar: 'ar', he: 'he', fa: 'fa', sv: 'sv', cs: 'cs', ro: 'ro',
    hu: 'hu', el: 'el', bn: 'bn', ms: 'ms', en: 'en',
  };
  return map[lang] && uiLocaleCodes.includes(map[lang]) ? map[lang] : 'en';
}

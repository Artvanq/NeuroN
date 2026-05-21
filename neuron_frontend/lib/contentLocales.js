/** Target languages for post/comment translation (Binance-style content locale). */
export const CONTENT_LOCALE_KEY = 'neuron_content_locale';
export const CONTENT_LOCALE_EVENT = 'neuron_content_locale';

/** Show posts in the language they were written (no auto-translation). */
export const ORIGINAL_LOCALE = 'original';

export const contentLocales = [
  { code: 'en', label: 'English', tag: 'EN' },
  { code: 'uk', label: 'Українська', tag: 'UA' },
  { code: 'ru', label: 'Русский', tag: 'RU' },
  { code: 'de', label: 'Deutsch', tag: 'DE' },
  { code: 'fr', label: 'Français', tag: 'FR' },
  { code: 'es', label: 'Español', tag: 'ES' },
  { code: 'pt', label: 'Português', tag: 'PT' },
  { code: 'it', label: 'Italiano', tag: 'IT' },
  { code: 'pl', label: 'Polski', tag: 'PL' },
  { code: 'nl', label: 'Nederlands', tag: 'NL' },
  { code: 'tr', label: 'Türkçe', tag: 'TR' },
  { code: 'vi', label: 'Tiếng Việt', tag: 'VI' },
  { code: 'id', label: 'Bahasa Indonesia', tag: 'ID' },
  { code: 'th', label: 'ไทย', tag: 'TH' },
  { code: 'hi', label: 'हिन्दी', tag: 'HI' },
  { code: 'zh', label: '中文', tag: 'ZH' },
  { code: 'ja', label: '日本語', tag: 'JA' },
  { code: 'ko', label: '한국어', tag: 'KO' },
  { code: 'ar', label: 'العربية', tag: 'AR' },
  { code: 'he', label: 'עברית', tag: 'HE' },
  { code: 'fa', label: 'فارسی', tag: 'FA' },
  { code: 'sv', label: 'Svenska', tag: 'SV' },
  { code: 'cs', label: 'Čeština', tag: 'CS' },
  { code: 'ro', label: 'Română', tag: 'RO' },
  { code: 'hu', label: 'Magyar', tag: 'HU' },
  { code: 'el', label: 'Ελληνικά', tag: 'EL' },
  { code: 'bn', label: 'বাংলা', tag: 'BN' },
  { code: 'ms', label: 'Bahasa Melayu', tag: 'MS' },
  { code: ORIGINAL_LOCALE, label: 'Original (no translation)', tag: '—' },
];

const codes = new Set(contentLocales.map((l) => l.code));

const browserToContent = {
  uk: 'uk',
  ua: 'uk',
  ru: 'ru',
  de: 'de',
  fr: 'fr',
  es: 'es',
  pt: 'pt',
  it: 'it',
  pl: 'pl',
  nl: 'nl',
  tr: 'tr',
  vi: 'vi',
  id: 'id',
  th: 'th',
  hi: 'hi',
  zh: 'zh',
  ja: 'ja',
  ko: 'ko',
  ar: 'ar',
  he: 'he',
  fa: 'fa',
  sv: 'sv',
  cs: 'cs',
  ro: 'ro',
  hu: 'hu',
  el: 'el',
  bn: 'bn',
  ms: 'ms',
  en: 'en',
};

export function inferBrowserContentLocale() {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language?.slice(0, 2)?.toLowerCase();
  return browserToContent[lang] || 'en';
}

export function getContentLocaleLabel(code) {
  return contentLocales.find((l) => l.code === code)?.label || code;
}

export function getContentLocaleTag(code) {
  return contentLocales.find((l) => l.code === code)?.tag || code.toUpperCase();
}

export function getContentLocale() {
  if (typeof window === 'undefined') return inferBrowserContentLocale();
  const stored = localStorage.getItem(CONTENT_LOCALE_KEY);
  if (codes.has(stored)) return stored;
  return inferBrowserContentLocale();
}

export function setContentLocale(code) {
  if (!codes.has(code)) return;
  localStorage.setItem(CONTENT_LOCALE_KEY, code);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CONTENT_LOCALE_EVENT));
  }
}

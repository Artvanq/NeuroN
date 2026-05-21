import { en, locales, loadLocaleBundle } from './locales';
import { inferBrowserUiLocale, rtlLocales } from './uiLocales';

export const STORAGE_KEY = 'neuron_locale';

export { locales, en };

export function getLocale() {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && locales.includes(stored)) return stored;
  return inferBrowserUiLocale();
}

export function applyDocumentLocale(code) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = code === 'uk' ? 'uk' : code;
  document.documentElement.dir = rtlLocales.has(code) ? 'rtl' : 'ltr';
}

export async function setLocale(code) {
  if (!locales.includes(code)) return;
  localStorage.setItem(STORAGE_KEY, code);
  applyDocumentLocale(code);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('neuron_locale'));
  }
}

export function t(key, bundle) {
  const b = bundle || en;
  return b[key] ?? en[key] ?? key;
}

export { loadLocaleBundle };

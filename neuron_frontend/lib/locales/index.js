import en from './en';
import { uiLocaleCodes } from '../uiLocales';

const loaders = {
  en: () => Promise.resolve(en),
  uk: () => import('./uk').then((m) => m.default),
  ru: () => import('./ru').then((m) => m.default),
  de: () => import('./de').then((m) => m.default),
  fr: () => import('./fr').then((m) => m.default),
  es: () => import('./es').then((m) => m.default),
  pt: () => import('./pt').then((m) => m.default),
  it: () => import('./it').then((m) => m.default),
  pl: () => import('./pl').then((m) => m.default),
  nl: () => import('./nl').then((m) => m.default),
  tr: () => import('./tr').then((m) => m.default),
  vi: () => import('./vi').then((m) => m.default),
  id: () => import('./id').then((m) => m.default),
  th: () => import('./th').then((m) => m.default),
  hi: () => import('./hi').then((m) => m.default),
  zh: () => import('./zh').then((m) => m.default),
  ja: () => import('./ja').then((m) => m.default),
  ko: () => import('./ko').then((m) => m.default),
  ar: () => import('./ar').then((m) => m.default),
  he: () => import('./he').then((m) => m.default),
  fa: () => import('./fa').then((m) => m.default),
  sv: () => import('./sv').then((m) => m.default),
  cs: () => import('./cs').then((m) => m.default),
  ro: () => import('./ro').then((m) => m.default),
  hu: () => import('./hu').then((m) => m.default),
  el: () => import('./el').then((m) => m.default),
  bn: () => import('./bn').then((m) => m.default),
  ms: () => import('./ms').then((m) => m.default),
};

const cache = { en };

export async function loadLocaleBundle(code) {
  if (cache[code]) return cache[code];
  const load = loaders[code];
  if (!load) return en;
  try {
    const bundle = await load();
    cache[code] = { ...en, ...bundle };
    return cache[code];
  } catch {
    return en;
  }
}

// Static require map — avoids a dynamic require() context that would make
// webpack scan the whole lib/locales/ folder (and try to bundle non-JS files
// like translate/*.json and README.md, breaking the build).
const syncLoaders = {
  en: () => en,
  uk: () => require('./uk').default,
  ru: () => require('./ru').default,
  de: () => require('./de').default,
  fr: () => require('./fr').default,
  es: () => require('./es').default,
  pt: () => require('./pt').default,
  it: () => require('./it').default,
  pl: () => require('./pl').default,
  nl: () => require('./nl').default,
  tr: () => require('./tr').default,
  vi: () => require('./vi').default,
  id: () => require('./id').default,
  th: () => require('./th').default,
  hi: () => require('./hi').default,
  zh: () => require('./zh').default,
  ja: () => require('./ja').default,
  ko: () => require('./ko').default,
  ar: () => require('./ar').default,
  he: () => require('./he').default,
  fa: () => require('./fa').default,
  sv: () => require('./sv').default,
  cs: () => require('./cs').default,
  ro: () => require('./ro').default,
  hu: () => require('./hu').default,
  el: () => require('./el').default,
  bn: () => require('./bn').default,
  ms: () => require('./ms').default,
};

export function loadLocaleBundleSync(code) {
  if (cache[code]) return cache[code];
  const load = syncLoaders[code];
  if (!load) return en;
  try {
    const bundle = load();
    cache[code] = { ...en, ...bundle };
    return cache[code];
  } catch {
    return en;
  }
}

export const locales = ['en', ...uiLocaleCodes.filter((c) => c !== 'en')];

export { en };

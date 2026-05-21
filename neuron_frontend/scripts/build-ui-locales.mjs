/**
 * Generate lib/locales/{code}.js from English source (Lingva → MyMemory fallback).
 * Usage: node scripts/build-ui-locales.mjs uk ru de
 *        node scripts/build-ui-locales.mjs --all
 *        node scripts/build-ui-locales.mjs --all --force
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const EN_PATH = path.join(ROOT, 'lib/locales/en.js');
const OUT_DIR = path.join(ROOT, 'lib/locales');

const ALL_CODES = [
  'uk', 'ru', 'de', 'fr', 'es', 'pt', 'it', 'pl', 'nl', 'tr', 'vi', 'id', 'th', 'hi',
  'zh', 'ja', 'ko', 'ar', 'he', 'fa', 'sv', 'cs', 'ro', 'hu', 'el', 'bn', 'ms',
];

const LINGVA_HOSTS = [
  'https://lingva.ml',
  'https://lingva.garudalinux.org',
  'https://translate.plausibility.cloud',
];
const MYMEMORY = 'https://api.mymemory.translated.net/get';
const DELAY_MS = 280;
const MIN_TRANSLATED_KEYS = 240;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function lingvaLang(code) {
  if (code === 'zh') return 'zh';
  return code;
}

async function translateLingva(text, target, source = 'en') {
  const q = encodeURIComponent(text);
  const src = lingvaLang(source);
  const tgt = lingvaLang(target);
  let lastErr;
  for (const host of LINGVA_HOSTS) {
    const url = `${host}/api/v1/${src}/${tgt}/${q}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.translation) return data.translation;
      throw new Error('no translation');
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('lingva failed');
}

async function translateMyMemory(text, target, source = 'en') {
  const pair = `${source}|${target}`;
  const url = `${MYMEMORY}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    const status = data.responseStatus ?? res.status;
    if (status === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    const rateLimited =
      res.status === 429 ||
      status === 429 ||
      String(data.responseDetails || '').toUpperCase().includes('QUOTA');
    if (rateLimited) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    throw new Error(data.responseDetails || `HTTP ${res.status}`);
  }
  throw new Error('MyMemory rate limit');
}

async function translateText(text, target, source = 'en') {
  if (!text?.trim()) return text;
  try {
    return await translateLingva(text, target, source);
  } catch {
    return translateMyMemory(text, target, source);
  }
}

async function loadEn() {
  const mod = await import(`file://${EN_PATH.replace(/\\/g, '/')}`);
  return mod.default;
}

async function loadExisting(code) {
  const file = path.join(OUT_DIR, `${code}.js`);
  if (!fs.existsSync(file)) return {};
  if (fs.readFileSync(file, 'utf8').length < 50) return {};
  try {
    const mod = await import(`file://${file.replace(/\\/g, '/')}?t=${Date.now()}`);
    return mod.default || {};
  } catch {
    return {};
  }
}

function translatedCount(en, bundle) {
  return Object.keys(en).filter((k) => bundle[k] && bundle[k] !== en[k]).length;
}

async function buildLocale(code, en, { force }) {
  const existing = await loadExisting(code);
  const done = translatedCount(en, existing);
  if (!force && done >= MIN_TRANSLATED_KEYS) {
    console.log(`Skip ${code} (${done} translated keys)`);
    return;
  }
  const out = { ...existing };
  const keys = Object.keys(en);
  let i = 0;
  let built = 0;
  for (const key of keys) {
    const src = en[key];
    if (!force && out[key] && out[key] !== src) {
      i += 1;
      continue;
    }
    try {
      out[key] = await translateText(src, code, 'en');
      if (out[key] !== src) built += 1;
    } catch (err) {
      console.warn(`  skip ${key}: ${err.message}`);
      out[key] = out[key] || src;
    }
    i += 1;
    if (i % 25 === 0) {
      console.log(`  ${code}: ${i}/${keys.length} (+${built} new)`);
    }
    if (i % 50 === 0) {
      const file = path.join(OUT_DIR, `${code}.js`);
      fs.writeFileSync(file, `export default ${JSON.stringify(out, null, 2)};\n`, 'utf8');
    }
    await sleep(DELAY_MS);
  }
  const file = path.join(OUT_DIR, `${code}.js`);
  fs.writeFileSync(file, `export default ${JSON.stringify(out, null, 2)};\n`, 'utf8');
  console.log(`Wrote ${file} (${translatedCount(en, out)} translated)`);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const codes = args.includes('--all')
    ? ALL_CODES
    : args.filter((c) => ALL_CODES.includes(c));
  if (!codes.length) {
    console.log('Usage: node scripts/build-ui-locales.mjs uk ru | --all [--force]');
    process.exit(1);
  }
  const en = await loadEn();
  for (const code of codes) {
    if (code === 'en') continue;
    console.log(`Building ${code}…`);
    await buildLocale(code, en, { force });
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

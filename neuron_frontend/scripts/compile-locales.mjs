/**
 * Compile filled translation JSON files into runtime locale bundles.
 *
 * Source:  lib/locales/translate/<code>.json   (you edit these — translate the values)
 * Output:  lib/locales/<code>.js               (loaded by the app)
 *
 * Usage:
 *   node scripts/compile-locales.mjs            # compile every JSON in translate/
 *   node scripts/compile-locales.mjs ja ko ar   # only these codes
 *
 * It also reports keys that are still identical to English (i.e. not translated yet),
 * so you can see what is left to do.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRANSLATE_DIR = path.join(ROOT, 'lib/locales/translate');
const OUT_DIR = path.join(ROOT, 'lib/locales');

const en = (await import(path.join(OUT_DIR, 'en.js'))).default;
const enKeys = Object.keys(en);

const argv = process.argv.slice(2);
const files = fs
  .readdirSync(TRANSLATE_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((code) => argv.length === 0 || argv.includes(code));

if (files.length === 0) {
  console.error('No matching JSON files in lib/locales/translate/');
  process.exit(1);
}

let hadError = false;

for (const code of files) {
  const jsonPath = path.join(TRANSLATE_DIR, `${code}.json`);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    console.error(`✗ ${code}: invalid JSON — ${err.message}`);
    hadError = true;
    continue;
  }

  // Keep key order identical to en.js; fall back to English for missing keys.
  const bundle = {};
  let untranslated = 0;
  const missing = [];
  for (const key of enKeys) {
    const val = data[key];
    if (val == null || val === '') {
      bundle[key] = en[key];
      missing.push(key);
    } else {
      bundle[key] = val;
      if (val === en[key]) untranslated += 1;
    }
  }

  const body = enKeys
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(bundle[k])},`)
    .join('\n');
  const out = `export default {\n${body}\n};\n`;
  fs.writeFileSync(path.join(OUT_DIR, `${code}.js`), out);

  const status =
    untranslated === 0 && missing.length === 0
      ? 'fully translated'
      : `${untranslated} still English` +
        (missing.length ? `, ${missing.length} missing (kept English)` : '');
  console.log(`✓ ${code}.js written — ${status}`);
}

process.exit(hadError ? 1 : 0);

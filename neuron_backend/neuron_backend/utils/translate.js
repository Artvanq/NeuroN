const crypto = require('crypto');
const prisma = require('./prisma');

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK = 480;

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizeLang(code) {
  if (!code || code === 'original' || code === 'auto') return null;
  const map = { 'zh-CN': 'zh', 'zh-TW': 'zh' };
  return map[code] || String(code).toLowerCase().slice(0, 5);
}

function chunkText(text) {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHUNK) return [trimmed];
  const parts = [];
  let rest = trimmed;
  while (rest.length > MAX_CHUNK) {
    let cut = rest.lastIndexOf(' ', MAX_CHUNK);
    if (cut < MAX_CHUNK / 2) cut = MAX_CHUNK;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function fetchMyMemory(text, targetLang, sourceLang) {
  const pair = `${sourceLang || 'auto'}|${targetLang}`;
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation provider error (${res.status})`);
  const data = await res.json();
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'Translation failed');
  }
  return data.responseData?.translatedText || text;
}

async function getCached(text, targetLang) {
  const sourceHash = hashText(text);
  const row = await prisma.translationCache.findUnique({
    where: { sourceHash_targetLang: { sourceHash, targetLang } },
  });
  return row?.translated ?? null;
}

async function setCache(text, targetLang, translated, sourceLang) {
  const sourceHash = hashText(text);
  await prisma.translationCache.upsert({
    where: { sourceHash_targetLang: { sourceHash, targetLang } },
    create: {
      sourceHash,
      sourceLang: sourceLang || 'auto',
      targetLang,
      sourceText: text.slice(0, 2000),
      translated,
    },
    update: { translated, sourceLang: sourceLang || 'auto' },
  });
}

async function translateChunk(text, targetLang, sourceLang) {
  const cached = await getCached(text, targetLang);
  if (cached != null) return cached;

  const translated = await fetchMyMemory(text, targetLang, sourceLang);
  await setCache(text, targetLang, translated, sourceLang);
  return translated;
}

async function translateText(text, targetLang, sourceLang = 'auto') {
  if (!text?.trim()) return { text: text || '', translated: false };
  const target = normalizeLang(targetLang);
  if (!target) return { text, translated: false };

  const chunks = chunkText(text);
  const out = [];
  for (const chunk of chunks) {
    out.push(await translateChunk(chunk, target, sourceLang));
  }
  const result = out.join(' ');
  const changed = result.trim().toLowerCase() !== text.trim().toLowerCase();
  return { text: result, translated: changed };
}

async function translateBatch(items, targetLang) {
  const target = normalizeLang(targetLang);
  if (!target) {
    return items.map((item) => ({
      id: item.id,
      text: item.text,
      translated: false,
    }));
  }

  const results = [];
  for (const item of items) {
    if (!item.text?.trim()) {
      results.push({ id: item.id, text: item.text || '', translated: false });
      continue;
    }
    try {
      const { text, translated } = await translateText(item.text, target);
      results.push({ id: item.id, text, translated });
    } catch {
      results.push({ id: item.id, text: item.text, translated: false, error: true });
    }
  }
  return results;
}

module.exports = {
  translateText,
  translateBatch,
  normalizeLang,
};

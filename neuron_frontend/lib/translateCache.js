const memory = new Map();

function cacheKey(text, locale) {
  return `${locale}:${text}`;
}

export function getCachedTranslation(text, locale) {
  return memory.get(cacheKey(text, locale));
}

export function setCachedTranslation(text, locale, translated, isTranslated) {
  memory.set(cacheKey(text, locale), { text: translated, translated: isTranslated });
}

export function clearTranslationCache() {
  memory.clear();
}

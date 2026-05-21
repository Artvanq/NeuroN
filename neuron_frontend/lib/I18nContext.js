import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getLocale,
  setLocale as persistLocale,
  applyDocumentLocale,
  t as translate,
  en,
  loadLocaleBundle,
  STORAGE_KEY,
} from './i18n';

const I18nContext = createContext({
  locale: 'en',
  setLocale: async () => {},
  t: (k) => k,
  ready: false,
});

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState('en');
  const [bundle, setBundle] = useState(en);
  const [ready, setReady] = useState(false);

  const applyLocale = useCallback(async (code) => {
    const merged = await loadLocaleBundle(code);
    setBundle(merged);
    setLocaleState(code);
    applyDocumentLocale(code);
    setReady(true);
  }, []);

  useEffect(() => {
    const code = getLocale();
    applyLocale(code);
    const onChange = () => {
      const next = localStorage.getItem(STORAGE_KEY) || getLocale();
      applyLocale(next);
    };
    window.addEventListener('neuron_locale', onChange);
    window.addEventListener('neuron_content_locale', onChange);
    return () => {
      window.removeEventListener('neuron_locale', onChange);
      window.removeEventListener('neuron_content_locale', onChange);
    };
  }, [applyLocale]);

  const setLocale = async (code) => {
    await persistLocale(code);
    await applyLocale(code);
  };

  const t = (key) => translate(key, bundle);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, ready }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

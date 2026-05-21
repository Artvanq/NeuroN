import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getContentLocale,
  setContentLocale as persistContentLocale,
  ORIGINAL_LOCALE,
  CONTENT_LOCALE_EVENT,
  inferBrowserContentLocale,
} from './contentLocales';
import { getMe, updateMe } from './api';
import { getStoredUser, isLoggedIn, updateStoredUser } from './auth';

const ContentLocaleContext = createContext({
  contentLocale: 'en',
  setContentLocale: () => {},
});

function profileToLocale(code) {
  if (!code) return null;
  return code === '' ? ORIGINAL_LOCALE : code;
}

export function ContentLocaleProvider({ children }) {
  const [contentLocale, setContentLocaleState] = useState('en');

  useEffect(() => {
    const apply = (code) => setContentLocaleState(code);
    apply(getContentLocale());

    const onChange = () => apply(getContentLocale());
    window.addEventListener(CONTENT_LOCALE_EVENT, onChange);

    const stored = getStoredUser();
    const fromProfile = profileToLocale(stored?.contentLocale);
    if (fromProfile) {
      persistContentLocale(fromProfile);
      apply(fromProfile);
    } else if (isLoggedIn()) {
      getMe()
        .then((user) => {
          const profileLoc = profileToLocale(user.contentLocale);
          if (profileLoc && profileLoc !== ORIGINAL_LOCALE) {
            persistContentLocale(profileLoc);
            apply(profileLoc);
            return;
          }
          const preferred = inferBrowserContentLocale();
          persistContentLocale(preferred);
          apply(preferred);
          updateMe({ contentLocale: preferred })
            .then((u) => updateStoredUser(u))
            .catch(() => {});
        })
        .catch(() => {});
    }

    return () => window.removeEventListener(CONTENT_LOCALE_EVENT, onChange);
  }, []);

  const setContentLocale = useCallback((code) => {
    persistContentLocale(code);
    setContentLocaleState(code);
    if (isLoggedIn()) {
      updateMe({ contentLocale: code })
        .then((user) => updateStoredUser(user))
        .catch(() => {});
    }
  }, []);

  return (
    <ContentLocaleContext.Provider value={{ contentLocale, setContentLocale }}>
      {children}
    </ContentLocaleContext.Provider>
  );
}

export function useContentLocale() {
  return useContext(ContentLocaleContext);
}

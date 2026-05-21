import { useState, useRef, useEffect } from 'react';
import { useContentLocale } from '../lib/ContentLocaleContext';
import { useI18n } from '../lib/I18nContext';
import {
  contentLocales,
  getContentLocaleLabel,
  getContentLocaleTag,
  ORIGINAL_LOCALE,
} from '../lib/contentLocales';

const translationLocales = contentLocales.filter((l) => l.code !== ORIGINAL_LOCALE);

export default function ContentLocaleSwitcher({ showLabel }) {
  const { contentLocale, setContentLocale } = useContentLocale();
  const { setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentTag = getContentLocaleTag(contentLocale);
  const currentLabel = getContentLocaleLabel(contentLocale);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="locale-switch" ref={ref}>
      <button
        type="button"
        className="locale-switch-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={t('locale_switcher_title')}
      >
        <span className="locale-tag">{currentTag}</span>
        {showLabel && <span className="locale-trigger-label">{currentLabel}</span>}
        <span className="locale-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="locale-menu-panel panel" role="listbox">
          <p className="locale-menu-title">{t('locale_menu_title')}</p>
          <p className="locale-menu-hint muted">{t('locale_menu_hint')}</p>
          <p className="locale-menu-hint muted">{t('locale_menu_ui_hint')}</p>
          <ul className="locale-menu">
            {translationLocales.map((loc) => (
              <li key={loc.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={contentLocale === loc.code}
                  className={contentLocale === loc.code ? 'active' : ''}
                  onClick={() => {
                    setContentLocale(loc.code);
                    setLocale(loc.code);
                    setOpen(false);
                  }}
                >
                  <span className="locale-tag">{loc.tag}</span>
                  <span className="locale-label">{loc.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            role="option"
            aria-selected={contentLocale === ORIGINAL_LOCALE}
            className={`locale-menu-original${contentLocale === ORIGINAL_LOCALE ? ' active' : ''}`}
            onClick={() => {
              setContentLocale(ORIGINAL_LOCALE);
              setOpen(false);
            }}
          >
            <span className="locale-tag">—</span>
            <span className="locale-label">{t('locale_original')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

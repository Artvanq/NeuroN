import { useState, useEffect } from 'react';
import MarkdownBody from './MarkdownBody';
import { useContentLocale } from '../lib/ContentLocaleContext';
import { ORIGINAL_LOCALE } from '../lib/contentLocales';
import { translateText } from '../lib/api';
import { getCachedTranslation, setCachedTranslation } from '../lib/translateCache';
import { useI18n } from '../lib/I18nContext';

export default function TranslatableMarkdown({ text, className }) {
  const { contentLocale } = useContentLocale();
  const { t } = useI18n();
  const [display, setDisplay] = useState(text || '');
  const [isTranslated, setIsTranslated] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setShowOriginal(false);
    const raw = text || '';
    if (!raw.trim() || contentLocale === ORIGINAL_LOCALE) {
      setDisplay(raw);
      setIsTranslated(false);
      setLoading(false);
      return undefined;
    }

    const cached = getCachedTranslation(raw, contentLocale);
    if (cached) {
      setDisplay(cached.text);
      setIsTranslated(cached.translated);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    translateText(raw, contentLocale)
      .then((res) => {
        if (cancelled) return;
        setCachedTranslation(raw, contentLocale, res.text, res.translated);
        setDisplay(res.text);
        setIsTranslated(res.translated);
      })
      .catch(() => {
        if (!cancelled) {
          setDisplay(raw);
          setIsTranslated(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [text, contentLocale]);

  const shown = showOriginal ? text : display;

  return (
    <div className={className}>
      {loading && <span className="muted md-loading">{t('loading')}</span>}
      <MarkdownBody>{shown}</MarkdownBody>
      {isTranslated && (
        <button
          type="button"
          className="link-btn translate-toggle"
          onClick={() => setShowOriginal((v) => !v)}
        >
          {showOriginal ? t('translate_show_translation') : t('translate_view_original')}
        </button>
      )}
    </div>
  );
}

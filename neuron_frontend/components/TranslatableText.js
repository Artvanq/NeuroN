import { useState, useEffect } from 'react';
import { useContentLocale } from '../lib/ContentLocaleContext';
import { ORIGINAL_LOCALE } from '../lib/contentLocales';
import { translateText } from '../lib/api';
import { getCachedTranslation, setCachedTranslation } from '../lib/translateCache';
import { useI18n } from '../lib/I18nContext';

export default function TranslatableText({
  text,
  className,
  as: Tag = 'span',
  inlineToggle = true,
  truncate,
}) {
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
      return;
    }

    const cached = getCachedTranslation(raw, contentLocale);
    if (cached) {
      setDisplay(cached.text);
      setIsTranslated(cached.translated);
      setLoading(false);
      return;
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
        if (cancelled) return;
        setDisplay(raw);
        setIsTranslated(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [text, contentLocale]);

  const source = showOriginal ? text : display;
  let visible = source || '';
  if (truncate && visible.length > truncate) {
    visible = `${visible.slice(0, truncate)}…`;
  }
  const canToggle = isTranslated && inlineToggle;

  return (
    <Tag className={className}>
      {loading && !showOriginal ? (
        <span className="translate-pending">
          {truncate && text && text.length > truncate
            ? `${text.slice(0, truncate)}…`
            : text}
        </span>
      ) : (
        visible
      )}
      {canToggle && (
        <>
          {' '}
          <button
            type="button"
            className="link-btn translate-toggle"
            onClick={() => setShowOriginal((v) => !v)}
          >
            {showOriginal ? t('translate_show_translation') : t('translate_view_original')}
          </button>
        </>
      )}
    </Tag>
  );
}

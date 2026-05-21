import Link from 'next/link';
import { useI18n } from '../lib/I18nContext';

export default function FieldsStrip({ categories, loading, activeSlug }) {
  const { t } = useI18n();

  if (loading && categories.length === 0) {
    return <p className="muted fields-strip-loading">{t('loading')}</p>;
  }

  if (categories.length === 0) return null;

  return (
    <div className="fields-strip-wrap">
      <div className="fields-strip-head">
        <div>
          <h2 className="fields-strip-title">{t('fields_title')}</h2>
          <p className="muted fields-strip-hint">{t('fields_subtitle')}</p>
        </div>
        <a href="#fields-all" className="fields-strip-all">
          {t('fields_browse')}
        </a>
      </div>
      <div className="fields-strip-scroll" role="list">
        <Link
          href="/explore"
          className={`field-chip${!activeSlug ? ' active' : ''}`}
          role="listitem"
        >
          {t('fields_all')}
        </Link>
        {categories.map((c) => (
          <Link
            key={c._id}
            href={`/c/${c.slug}`}
            className={`field-chip${activeSlug === c.slug ? ' active' : ''}`}
            style={{ '--field-color': c.color }}
            role="listitem"
          >
            <span className="field-chip-icon">{c.icon || '📚'}</span>
            <span>{c.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

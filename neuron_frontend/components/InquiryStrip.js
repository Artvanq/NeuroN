import Link from 'next/link';
import { useI18n } from '../lib/I18nContext';

export default function InquiryStrip({ inquiries = [], loading, activeSlug }) {
  const { t } = useI18n();
  const list = Array.isArray(inquiries) ? inquiries : [];

  if (loading && list.length === 0) {
    return <p className="muted fields-strip-loading">{t('loading')}</p>;
  }

  if (list.length === 0) return null;

  return (
    <div className="fields-strip-wrap inquiry-strip-wrap">
      <div className="fields-strip-head">
        <h2 className="fields-strip-title">{t('inquiries_title')}</h2>
        <span className="muted fields-strip-hint">{t('inquiries_hint')}</span>
      </div>
      <div className="fields-strip-scroll" role="list">
        {list.slice(0, 24).map((inq) => (
          <Link
            key={inq._id}
            href={`/i/${inq.slug}`}
            className={`field-chip inquiry-chip${activeSlug === inq.slug ? ' active' : ''}`}
            role="listitem"
            title={inq.description || inq.name}
          >
            <span>{inq.name}</span>
            {inq.threadCount > 0 && (
              <span className="inquiry-chip-count">{inq.threadCount}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

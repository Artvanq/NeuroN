import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCompatibleMinds } from '../lib/api';
import { useI18n } from '../lib/I18nContext';
import { isLoggedIn } from '../lib/auth';

export default function CompatibleMinds() {
  const { t } = useI18n();
  const [minds, setMinds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    getCompatibleMinds()
      .then((list) => {
        if (!cancelled) setMinds(list);
      })
      .catch(() => {
        if (!cancelled) setMinds([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isLoggedIn() || loading || minds.length === 0) {
    return null;
  }

  return (
    <section className="panel compatible-minds" aria-label={t('compatible_minds_title')}>
      <h2 className="compatible-minds-title">{t('compatible_minds_title')}</h2>
      <p className="muted compatible-minds-desc">{t('compatible_minds_desc')}</p>
      <ul className="compatible-minds-list">
        {minds.map((mind) => (
          <li key={mind._id}>
            <Link href={`/u/${mind.username}`} className="compatible-mind-card">
              <span className="compatible-mind-name">{mind.displayName || mind.username}</span>
              <span className="compatible-mind-meta">
                @{mind.username}
                {mind.sharedFields > 0 && (
                  <>
                    {' '}
                    · {mind.sharedFields}{' '}
                    {mind.sharedFields === 1 ? 'shared field' : 'shared fields'}
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

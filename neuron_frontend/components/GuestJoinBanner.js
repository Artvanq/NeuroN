import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isLoggedIn } from '../lib/auth';
import { useI18n } from '../lib/I18nContext';

export default function GuestJoinBanner() {
  const { t } = useI18n();
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    setGuest(!isLoggedIn());
  }, []);

  if (!guest) return null;

  return (
    <section className="guest-join-banner panel panel-glass" aria-label={t('guest_banner_title')}>
      <div className="guest-join-banner-inner">
        <div>
          <p className="guest-join-eyebrow">{t('guest_banner_eyebrow')}</p>
          <p className="guest-join-title">{t('guest_banner_title')}</p>
          <p className="muted guest-join-desc">{t('guest_banner_desc')}</p>
        </div>
        <div className="guest-join-actions">
          <Link href="/register" className="btn btn-primary">
            {t('manifest_join')}
          </Link>
          <Link href="/login" className="btn btn-ghost">
            {t('manifest_signin')}
          </Link>
        </div>
      </div>
    </section>
  );
}

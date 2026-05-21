import Link from 'next/link';
import { useRouter } from 'next/router';
import { useI18n } from '../lib/I18nContext';
import { isLoggedIn } from '../lib/auth';

export default function AskFab() {
  const router = useRouter();
  const { t } = useI18n();

  if (router.pathname === '/new') return null;

  const href = isLoggedIn() ? '/new' : '/login?next=/new';

  return (
    <Link href={href} className="ask-fab" aria-label={t('fab_ask')}>
      <span className="ask-fab-icon" aria-hidden>
        +
      </span>
      <span className="ask-fab-text">{t('fab_ask')}</span>
    </Link>
  );
}
